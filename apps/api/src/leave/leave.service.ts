import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { LeaveStatus, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateLeaveDto, LeaveRangeDto, ReviewLeaveDto } from './dto.js';

// Policy: every calendar month includes 1 paid leave (no carry-forward). All other leave days are unpaid and deducted from salary.
export const PAID_LEAVES_PER_MONTH = 1;
const MAX_RANGE_DAYS = 92;
const BACKDATE_DAYS = 30;
const DAY = 86_400_000;

type Db = Prisma.TransactionClient;
export type MonthSplit = { month: string; days: number; paid: number; unpaid: number };
type Split = { totalDays: number; paidDays: number; unpaidDays: number; months: MonthSplit[] };
type LeaveRow = { id: string; startDate: Date; endDate: Date; reason: string; status: LeaveStatus; reviewNote: string | null; reviewedAt: Date | null; createdAt: Date; totalDays: number; paidDays: number; unpaidDays: number; breakdown: unknown; user?: { id: string; name: string }; reviewedBy?: { name: string } | null };

const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const dayString = (date: Date) => date.toISOString().slice(0, 10);
const monthBounds = (month: string) => {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return { start: new Date(Date.UTC(year, index - 1, 1)), end: new Date(Date.UTC(year, index, 0)) };
};
const parseBreakdown = (value: unknown): MonthSplit[] => (Array.isArray(value) ? (value as MonthSplit[]).filter((entry) => entry && typeof entry.month === 'string') : []);

@Injectable()
export class LeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private isManager(actor: SessionUser) {
    return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'SALES_MANAGER');
  }

  private ensureStaff(actor: SessionUser) {
    if (actor.portal !== 'STAFF') throw new ForbiddenException('Leave is applied for from the staff portal.');
  }

  private ensureReviewer(actor: SessionUser) {
    if (!this.isAdmin(actor) && !this.isManager(actor)) throw new ForbiddenException('Reviewing leave is restricted to administrators and sales managers.');
  }

  private today() {
    const india = new Date(Date.now() + 330 * 60 * 1000);
    return new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()));
  }

  private dateKey(value: string) {
    const [year, month, day] = value.split('-').map(Number) as [number, number, number];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new BadRequestException('Enter a valid date.');
    return date;
  }

  private range(dto: LeaveRangeDto) {
    const start = this.dateKey(dto.startDate);
    const end = this.dateKey(dto.endDate);
    if (end < start) throw new BadRequestException('End date must be on or after the start date.');
    if ((end.getTime() - start.getTime()) / DAY + 1 > MAX_RANGE_DAYS) throw new BadRequestException(`Leave can cover at most ${MAX_RANGE_DAYS} days in one request.`);
    return { start, end };
  }

  // Days that actually count as leave: weekly offs and company holidays are skipped.
  private async chargeableDays(db: Db, start: Date, end: Date) {
    const [settings, holidays] = await Promise.all([
      db.operationsSettings.findUnique({ where: { id: 'default' }, select: { weeklyOffDays: true } }),
      db.holiday.findMany({ where: { date: { gte: start, lte: end } }, select: { date: true } }),
    ]);
    const weeklyOff = (settings?.weeklyOffDays as number[] | null) ?? [0];
    const off = new Set(holidays.map((holiday) => holiday.date.getTime()));
    const days: Date[] = [];
    for (let time = start.getTime(); time <= end.getTime(); time += DAY) {
      const date = new Date(time);
      if (!weeklyOff.includes(date.getUTCDay()) && !off.has(time)) days.push(date);
    }
    return days;
  }

  // Paid days already granted from approved requests, per month (optionally ignoring one request that is being re-evaluated).
  private async paidUsed(db: Db, userId: string, months: string[], excludeId?: string) {
    const first = monthBounds(months[0]!).start;
    const last = monthBounds(months[months.length - 1]!).end;
    const approved = await db.leaveRequest.findMany({ where: { userId, status: 'APPROVED', ...(excludeId ? { id: { not: excludeId } } : {}), startDate: { lte: last }, endDate: { gte: first } }, select: { breakdown: true } });
    const used = new Map<string, number>(months.map((month) => [month, 0]));
    for (const row of approved) for (const entry of parseBreakdown(row.breakdown)) if (used.has(entry.month)) used.set(entry.month, used.get(entry.month)! + entry.paid);
    return used;
  }

  private async split(db: Db, userId: string, start: Date, end: Date, excludeId?: string): Promise<Split> {
    const days = await this.chargeableDays(db, start, end);
    const counts = new Map<string, number>();
    for (const date of days) counts.set(monthKey(date), (counts.get(monthKey(date)) ?? 0) + 1);
    const months = [...counts.keys()].sort();
    if (!months.length) return { totalDays: 0, paidDays: 0, unpaidDays: 0, months: [] };
    const used = await this.paidUsed(db, userId, months, excludeId);
    const result = months.map((month) => {
      const count = counts.get(month)!;
      const paid = Math.min(count, Math.max(0, PAID_LEAVES_PER_MONTH - (used.get(month) ?? 0)));
      return { month, days: count, paid, unpaid: count - paid };
    });
    return { totalDays: days.length, paidDays: result.reduce((sum, entry) => sum + entry.paid, 0), unpaidDays: result.reduce((sum, entry) => sum + entry.unpaid, 0), months: result };
  }

  // Pending requests show what would happen if approved now; decided requests show the stored result.
  private async present(row: LeaveRow) {
    const pending = row.status === 'PENDING';
    const split = pending ? await this.split(this.prisma, row.user?.id ?? (await this.ownerOf(row.id)), row.startDate, row.endDate, row.id) : { totalDays: row.totalDays, paidDays: row.paidDays, unpaidDays: row.unpaidDays, months: parseBreakdown(row.breakdown) };
    const rejected = row.status === 'REJECTED';
    return {
      id: row.id,
      staff: row.user ? { id: row.user.id, name: row.user.name } : undefined,
      startDate: dayString(row.startDate),
      endDate: dayString(row.endDate),
      reason: row.reason,
      status: row.status,
      reviewNote: row.reviewNote,
      reviewedByName: row.reviewedBy?.name ?? null,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      totalDays: split.totalDays,
      paidDays: rejected ? 0 : split.paidDays,
      unpaidDays: rejected ? 0 : split.unpaidDays,
      months: rejected ? [] : split.months,
      estimated: pending,
    };
  }

  private async ownerOf(id: string) {
    return (await this.prisma.leaveRequest.findUniqueOrThrow({ where: { id }, select: { userId: true } })).userId;
  }

  async preview(actor: SessionUser, dto: LeaveRangeDto) {
    this.ensureStaff(actor);
    const { start, end } = this.range(dto);
    return this.split(this.prisma, actor.id, start, end);
  }

  async summary(actor: SessionUser, month?: string) {
    this.ensureStaff(actor);
    const key = month ?? monthKey(this.today());
    const { start, end } = monthBounds(key);
    const [approved, pending] = await Promise.all([
      this.prisma.leaveRequest.findMany({ where: { userId: actor.id, status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } }, select: { breakdown: true } }),
      this.prisma.leaveRequest.count({ where: { userId: actor.id, status: 'PENDING' } }),
    ]);
    let paidUsed = 0; let unpaid = 0;
    for (const row of approved) for (const entry of parseBreakdown(row.breakdown)) if (entry.month === key) { paidUsed += entry.paid; unpaid += entry.unpaid; }
    return { month: key, paidAllowance: PAID_LEAVES_PER_MONTH, paidUsed, paidAvailable: Math.max(0, PAID_LEAVES_PER_MONTH - paidUsed), unpaidDays: unpaid, pending };
  }

  async mine(actor: SessionUser) {
    this.ensureStaff(actor);
    const rows = await this.prisma.leaveRequest.findMany({ where: { userId: actor.id }, include: { reviewedBy: { select: { name: true } } }, orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }], take: 100 });
    return Promise.all(rows.map((row) => this.present(row)));
  }

  async create(actor: SessionUser, dto: CreateLeaveDto, ipAddress?: string) {
    this.ensureStaff(actor);
    const { start, end } = this.range(dto);
    if (start.getTime() < this.today().getTime() - BACKDATE_DAYS * DAY) throw new BadRequestException(`Leave can only be applied for dates within the last ${BACKDATE_DAYS} days or later.`);
    const overlap = await this.prisma.leaveRequest.findFirst({ where: { userId: actor.id, status: { in: ['PENDING', 'APPROVED'] }, startDate: { lte: end }, endDate: { gte: start } }, select: { id: true } });
    if (overlap) throw new BadRequestException('You already have a leave request covering some of these dates.');
    const split = await this.split(this.prisma, actor.id, start, end);
    if (!split.totalDays) throw new BadRequestException('These dates are weekly offs or holidays, so no leave is needed.');
    const created = await this.prisma.leaveRequest.create({ data: { userId: actor.id, startDate: start, endDate: end, reason: dto.reason, totalDays: split.totalDays }, include: { reviewedBy: { select: { name: true } } } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAVE_REQUEST', entity: 'LEAVE_REQUEST', entityId: created.id, details: { startDate: dto.startDate, endDate: dto.endDate, totalDays: split.totalDays }, ipAddress });
    return this.present(created);
  }

  async cancel(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureStaff(actor);
    const row = await this.prisma.leaveRequest.findFirst({ where: { id, userId: actor.id }, select: { id: true, status: true } });
    if (!row) throw new NotFoundException('Leave request not found.');
    if (row.status !== 'PENDING') throw new BadRequestException('Only a pending request can be cancelled.');
    await this.prisma.leaveRequest.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAVE_CANCEL', entity: 'LEAVE_REQUEST', entityId: id, ipAddress });
    return { ok: true };
  }

  async listForReview(actor: SessionUser, status?: LeaveStatus) {
    this.ensureReviewer(actor);
    const rows = await this.prisma.leaveRequest.findMany({
      where: { ...(status ? { status } : {}), ...(this.isAdmin(actor) ? {} : { user: { managerId: actor.id } }) },
      include: { user: { select: { id: true, name: true } }, reviewedBy: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      take: 150,
    });
    return Promise.all(rows.map((row) => this.present(row)));
  }

  async review(actor: SessionUser, id: string, dto: ReviewLeaveDto, ipAddress?: string) {
    this.ensureReviewer(actor);
    const note = dto.reviewNote?.trim() || null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({ where: { id }, include: { user: { select: { id: true, name: true, managerId: true } } } });
      if (!request) throw new NotFoundException('Leave request not found.');
      if (request.status !== 'PENDING') throw new BadRequestException('This request has already been reviewed.');
      if (!this.isAdmin(actor) && request.user.managerId !== actor.id) throw new ForbiddenException('You can only review requests for your own team.');
      // The paid/unpaid split is decided now, against what has already been approved this month.
      const split = dto.status === 'APPROVED' ? await this.split(tx, request.userId, request.startDate, request.endDate, request.id) : null;
      return tx.leaveRequest.update({
        where: { id },
        data: { status: dto.status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note, ...(split ? { totalDays: split.totalDays, paidDays: split.paidDays, unpaidDays: split.unpaidDays, breakdown: split.months as unknown as Prisma.InputJsonValue } : {}) },
        include: { user: { select: { id: true, name: true } }, reviewedBy: { select: { name: true } } },
      });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: dto.status === 'APPROVED' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT', entity: 'LEAVE_REQUEST', entityId: id, details: { userId: updated.userId, paidDays: updated.paidDays, unpaidDays: updated.unpaidDays }, ipAddress });
    return this.present(updated);
  }

  // Admin: approved leave per person for one month; "unpaid" is the number of days to deduct from that month's salary.
  async report(actor: SessionUser, month?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('The salary deduction report is restricted to administrators.');
    const key = month ?? monthKey(this.today());
    const { start, end } = monthBounds(key);
    const rows = await this.prisma.leaveRequest.findMany({ where: { status: 'APPROVED', startDate: { lte: end }, endDate: { gte: start } }, select: { userId: true, breakdown: true, user: { select: { name: true } } } });
    const people = new Map<string, { userId: string; name: string; days: number; paid: number; unpaid: number; requests: number }>();
    for (const row of rows) {
      const entry = parseBreakdown(row.breakdown).find((item) => item.month === key);
      if (!entry) continue;
      const person = people.get(row.userId) ?? { userId: row.userId, name: row.user.name, days: 0, paid: 0, unpaid: 0, requests: 0 };
      person.days += entry.days; person.paid += entry.paid; person.unpaid += entry.unpaid; person.requests += 1;
      people.set(row.userId, person);
    }
    const list = [...people.values()].sort((a, b) => b.unpaid - a.unpaid || a.name.localeCompare(b.name));
    return { month: key, paidAllowance: PAID_LEAVES_PER_MONTH, rows: list, totals: { staff: list.length, days: list.reduce((s, p) => s + p.days, 0), paid: list.reduce((s, p) => s + p.paid, 0), unpaid: list.reduce((s, p) => s + p.unpaid, 0) } };
  }
}
