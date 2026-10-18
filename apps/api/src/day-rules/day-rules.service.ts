import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { istDateKey } from './day-rules.js';

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86_400_000;
const SALES_ROLES = ['SALES_MANAGER', 'SALES_EXECUTIVE'];
const utcDay = (key: string) => new Date(`${key}T00:00:00.000Z`);

export type DayFacts = { verifiedCalls: number; reportSubmittedAt: Date | null };
export type DayGate = { blocked: boolean; approved: boolean; requiredDate: string | null; message: string | null };
const OPEN: DayGate = { blocked: false, approved: false, requiredDate: null, message: null };

@Injectable()
export class DayRulesService {
  constructor(private readonly prisma: PrismaService) {}

  // The first day the field rules apply. Earlier days keep the old hours-based rule so history is never re-marked.
  async strictFrom() {
    const settings = await this.prisma.operationsSettings.findUnique({ where: { id: 'default' }, select: { strictDayRulesFrom: true } });
    return settings?.strictDayRulesFrom ?? null;
  }

  // GPS-verified salon visits per person per day, and the day's report, for the date range [start, end) (UTC midnights of IST dates).
  async facts(userIds: string[], start: Date, end: Date) {
    const facts = new Map<string, DayFacts>();
    if (!userIds.length) return facts;
    const key = (userId: string, day: string) => `${userId}|${day}`;
    const entry = (userId: string, day: string) => facts.get(key(userId, day)) ?? facts.set(key(userId, day), { verifiedCalls: 0, reportSubmittedAt: null }).get(key(userId, day))!;
    const [visits, reports] = await Promise.all([
      this.prisma.clientActivity.findMany({
        where: { type: 'VISIT', createdById: { in: userIds }, checkInAt: { gte: new Date(start.getTime() - IST_OFFSET_MS), lt: new Date(end.getTime() - IST_OFFSET_MS) }, visitProof: { is: { gpsVerified: true } } },
        select: { createdById: true, checkInAt: true },
      }),
      this.prisma.dailySalesReport.findMany({ where: { staffId: { in: userIds }, reportDate: { gte: start, lt: end } }, select: { staffId: true, reportDate: true, submittedAt: true } }),
    ]);
    for (const visit of visits) if (visit.checkInAt) entry(visit.createdById, istDateKey(visit.checkInAt)).verifiedCalls += 1;
    for (const report of reports) entry(report.staffId, report.reportDate.toISOString().slice(0, 10)).reportSubmittedAt = report.submittedAt;
    return facts;
  }

  factsFor(facts: Map<string, DayFacts>, userId: string, dayKey: string): DayFacts {
    return facts.get(`${userId}|${dayKey}`) ?? { verifiedCalls: 0, reportSubmittedAt: null };
  }

  // Is this person allowed to start working today? Starting is blocked when the last working day's report was never
  // submitted, until an administrator approves the start.
  async gate(userId: string, now = new Date()): Promise<DayGate> {
    const from = await this.strictFrom();
    if (!from) return OPEN;
    const todayKey = istDateKey(now);
    const today = utcDay(todayKey);
    const [settings, holidays, leaves, user] = await Promise.all([
      this.prisma.operationsSettings.findUnique({ where: { id: 'default' }, select: { weeklyOffDays: true } }),
      this.prisma.holiday.findMany({ where: { date: { gte: new Date(today.getTime() - 8 * DAY_MS), lt: today } }, select: { date: true } }),
      this.prisma.leaveRequest.findMany({ where: { userId, status: 'APPROVED', startDate: { lt: today }, endDate: { gte: new Date(today.getTime() - 8 * DAY_MS) } }, select: { startDate: true, endDate: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, roles: { select: { role: { select: { key: true } } } } } }),
    ]);
    if (!user || !user.roles.some(({ role }) => SALES_ROLES.includes(role.key))) return OPEN;
    const weeklyOff = (settings?.weeklyOffDays as number[] | null) ?? [0];
    const holidayTimes = new Set(holidays.map((holiday) => holiday.date.getTime()));
    // The most recent working day before today (weekly offs, holidays and approved leave do not need a report).
    let required: Date | null = null;
    for (let back = 1; back <= 8; back += 1) {
      const day = new Date(today.getTime() - back * DAY_MS);
      const off = weeklyOff.includes(day.getUTCDay()) || holidayTimes.has(day.getTime()) || leaves.some((leave) => leave.startDate.getTime() <= day.getTime() && leave.endDate.getTime() >= day.getTime());
      if (!off) { required = day; break; }
    }
    if (!required || required.getTime() < from.getTime()) return OPEN;
    // A day only needs a report if the account already existed for all of it.
    if (istDateKey(user.createdAt) >= required.toISOString().slice(0, 10)) return OPEN;
    const [report, approval] = await Promise.all([
      this.prisma.dailySalesReport.findUnique({ where: { staffId_reportDate: { staffId: userId, reportDate: required } }, select: { id: true } }),
      this.prisma.dayStartApproval.findUnique({ where: { userId_date: { userId, date: today } }, select: { id: true } }),
    ]);
    if (report) return OPEN;
    const requiredDate = required.toISOString().slice(0, 10);
    if (approval) return { blocked: false, approved: true, requiredDate, message: null };
    return { blocked: true, approved: false, requiredDate, message: `Your daily report for ${requiredDate} was not submitted. Ask your administrator to approve today’s start.` };
  }

  async assertCanStart(userId: string) {
    const gate = await this.gate(userId);
    if (gate.blocked) throw new ForbiddenException(gate.message);
  }

  // Sales staff who cannot start today until an administrator approves them.
  async blockedToday(now = new Date()) {
    const staff = await this.prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { key: { in: SALES_ROLES }, isActive: true } } } }, select: { id: true, name: true, loginId: true }, orderBy: { name: 'asc' } });
    const gates = await Promise.all(staff.map(async (member) => ({ member, gate: await this.gate(member.id, now) })));
    return gates.filter((item) => item.gate.blocked).map((item) => ({ id: item.member.id, name: item.member.name, loginId: item.member.loginId, missingReportDate: item.gate.requiredDate }));
  }

  async approveStart(actor: SessionUser, userId: string, note?: string, ipAddress?: string) {
    if (!(actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'))) throw new ForbiddenException('Only an administrator can approve a day start.');
    const member = await this.prisma.user.findFirst({ where: { id: userId, roles: { some: { role: { key: { in: SALES_ROLES } } } } }, select: { id: true, name: true } });
    if (!member) throw new NotFoundException('Staff member not found.');
    const date = utcDay(istDateKey(new Date()));
    const approval = await this.prisma.dayStartApproval.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, approvedById: actor.id, note: note?.trim() || null }, update: { approvedById: actor.id, note: note?.trim() || null } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DAY_START_APPROVE', entity: 'USER', entityId: userId, details: { date: date.toISOString().slice(0, 10), note: note?.trim() || null }, ipAddress });
    return { id: approval.id, userId, name: member.name, date: date.toISOString().slice(0, 10) };
  }
}
