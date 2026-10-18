import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AttendanceService } from '../attendance/attendance.service.js';
import { countedOrders } from '../common/counted-orders.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BoardQueryDto, TeamActivitiesQueryDto, TeamLeadsQueryDto } from './dto.js';

const SALES_ROLES = ['SALES_MANAGER', 'SALES_EXECUTIVE'];
const WORKING = new Set(['PRESENT', 'LATE', 'HALF_DAY', 'IN_PROGRESS']);
const DAY_MS = 86_400_000;
const salesStaffWhere: Prisma.UserWhereInput = { status: 'ACTIVE', roles: { some: { role: { key: { in: SALES_ROLES }, isActive: true } } } };

const istToday = () => new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
const role = (user: { roles: Array<{ role: { name: string; priority: number } }>; staffProfile: { isTechnician: boolean } | null }) =>
  user.staffProfile?.isTechnician ? 'Technician' : [...user.roles].sort((a, b) => a.role.priority - b.role.priority)[0]?.role.name ?? 'Staff';

@Injectable()
export class TeamActivityService {
  constructor(private readonly prisma: PrismaService, private readonly attendance: AttendanceService) {}

  // Read-only monitoring for the Super Admin.
  private ensureAdmin(actor: SessionUser) {
    if (!(actor.portal === 'ADMIN' && actor.roles.some((item) => item.key === 'SUPER_ADMIN'))) throw new ForbiddenException('Team activity is restricted to administrators.');
  }

  private day(value?: string) {
    const key = value ?? istToday();
    const date = new Date(`${key}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== key) throw new BadRequestException('Enter a valid date.');
    return { key, date, start: new Date(date.getTime() - 330 * 60 * 1000) };
  }

  async staffOptions(actor: SessionUser) {
    this.ensureAdmin(actor);
    return this.prisma.user.findMany({ where: salesStaffWhere, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  // One row per salesperson for the chosen day: attendance, visits and the Daily Report. Totals cover everyone; rows are paged.
  async board(actor: SessionUser, query: BoardQueryDto) {
    this.ensureAdmin(actor);
    const { date, start } = this.day(query.date);
    const end = new Date(start.getTime() + DAY_MS);
    const search = query.search?.trim();
    const staff = await this.prisma.user.findMany({
      where: { ...salesStaffWhere, ...(search ? { OR: [{ name: { contains: search } }, { loginId: { contains: search } }] } : {}) },
      select: { id: true, name: true, loginId: true, staffProfile: { select: { shiftStart: true, shiftEnd: true, isTechnician: true } }, roles: { select: { role: { select: { name: true, priority: true } } } } },
      orderBy: { name: 'asc' },
    });
    const ids = staff.map((member) => member.id);
    const [days, reports, visitTotals, openVisits] = await Promise.all([
      this.attendance.classifyStaffOnDate(date, staff),
      this.prisma.dailySalesReport.findMany({ where: { staffId: { in: ids }, reportDate: date }, select: { id: true, staffId: true, submittedAt: true, calls: { select: { result: true, orderValue: true } } } }),
      this.prisma.clientActivity.groupBy({ by: ['createdById'], where: { type: 'VISIT', createdById: { in: ids }, checkInAt: { gte: start, lt: end } }, _count: { _all: true } }),
      this.prisma.clientActivity.groupBy({ by: ['createdById'], where: { type: 'VISIT', createdById: { in: ids }, checkInAt: { gte: start, lt: end }, checkOutAt: null }, _count: { _all: true } }),
    ]);

    const rows = staff.map((member) => {
      const classified = days.get(member.id)!;
      const report = reports.find((item) => item.staffId === member.id);
      const orders = report?.calls.filter((call) => call.result === 'ORDER') ?? [];
      return {
        staffId: member.id,
        name: member.name,
        loginId: member.loginId,
        roleName: role(member),
        status: classified.status,
        onLeave: classified.isOnLeave,
        firstActivityAt: classified.record?.punchInAt ?? null,
        lastActivityAt: classified.record?.punchOutAt ?? null,
        workingHours: classified.workingHours,
        fromVisits: classified.record?.fromVisits ?? false,
        verifiedCalls: classified.verifiedCalls ?? null,
        dayNote: classified.dayNote ?? null,
        visits: visitTotals.find((item) => item.createdById === member.id)?._count._all ?? 0,
        openVisits: openVisits.find((item) => item.createdById === member.id)?._count._all ?? 0,
        report: report ? { id: report.id, submittedAt: report.submittedAt, calls: report.calls.length, orders: orders.length, value: orders.reduce((sum, call) => sum + Number(call.orderValue ?? 0), 0) } : null,
      };
    });

    const working = rows.filter((row) => WORKING.has(row.status));
    const totals = {
      staff: rows.length,
      working: working.length,
      onLeave: rows.filter((row) => row.status === 'LEAVE').length,
      reportsSubmitted: rows.filter((row) => row.report).length,
      reportsMissing: working.filter((row) => !row.report).length,
      visits: rows.reduce((sum, row) => sum + row.visits, 0),
      orderValue: rows.reduce((sum, row) => sum + (row.report?.value ?? 0), 0),
    };
    const shown = rows.filter((row) => query.show === 'missing-report' ? WORKING.has(row.status) && !row.report : query.show === 'not-working' ? !WORKING.has(row.status) : true);
    const total = shown.length;
    return { date: date.toISOString().slice(0, 10), totals, items: shown.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: query.page, pageSize: query.pageSize, total, hasMore: query.page * query.pageSize < total };
  }

  // Everything one person did on one day: where they went, their attendance and the full Daily Report.
  async dayDetail(actor: SessionUser, staffId: string, dateValue?: string) {
    this.ensureAdmin(actor);
    return this.staffDay(staffId, dateValue);
  }

  // A salesperson's own day, opened from the calendar in their Attendance screen.
  async myDay(actor: SessionUser, dateValue?: string) {
    if (actor.portal !== 'STAFF' || !actor.roles.some((item) => SALES_ROLES.includes(item.key))) throw new ForbiddenException('Daily details are available to sales staff only.');
    return this.staffDay(actor.id, dateValue);
  }

  private async staffDay(staffId: string, dateValue?: string) {
    const { date } = this.day(dateValue);
    const member = await this.prisma.user.findFirst({
      where: { id: staffId, roles: { some: { role: { key: { in: SALES_ROLES } } } } },
      select: { id: true, name: true, loginId: true, status: true, staffProfile: { select: { shiftStart: true, shiftEnd: true, isTechnician: true, workLocation: true } }, roles: { select: { role: { select: { name: true, priority: true } } } } },
    });
    if (!member) throw new NotFoundException('Staff member not found.');
    const [days, leave, visits, stops, report] = await Promise.all([
      this.attendance.classifyStaffOnDate(date, [member]),
      this.prisma.leaveRequest.findFirst({ where: { userId: staffId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } }, select: { reason: true } }),
      this.prisma.clientActivity.findMany({
        where: { type: 'VISIT', createdById: staffId, routeStop: { is: { route: { staffId, routeDate: date } } } },
        select: { id: true, checkInAt: true, checkOutAt: true, visitOutcome: true, client: { select: { id: true, salonName: true, city: true, area: true, latitude: true, longitude: true } }, routeStop: { select: { id: true } }, visitProof: { select: { distanceMeters: true, gpsVerified: true, checkInLatitude: true, checkInLongitude: true } } },
        orderBy: { checkInAt: 'asc' },
      }),
      this.prisma.routeStop.findMany({ where: { route: { staffId, routeDate: date }, status: { not: 'REMOVED' } }, select: { id: true, status: true, note: true, client: { select: { salonName: true, city: true } } }, orderBy: { sequence: 'asc' } }),
      this.prisma.dailySalesReport.findUnique({
        where: { staffId_reportDate: { staffId, reportDate: date } },
        include: { calls: { orderBy: { sequence: 'asc' }, select: { id: true, customerName: true, customerType: true, result: true, orderValue: true, remark: true, visitActivityId: true, photoCapturedAt: true } }, coworker: { select: { name: true } }, tomorrowRoute: { select: { stops: { where: { status: { not: 'REMOVED' } }, orderBy: { sequence: 'asc' }, select: { client: { select: { salonName: true, city: true } } } } } } },
      }),
    ]);
    const classified = days.get(staffId)!;
    const calls = report?.calls.map((call) => ({ ...call, orderValue: call.orderValue == null ? null : Number(call.orderValue) })) ?? [];
    const orders = calls.filter((call) => call.result === 'ORDER');
    return {
      date: date.toISOString().slice(0, 10),
      staff: { id: member.id, name: member.name, loginId: member.loginId, roleName: role(member), workLocation: member.staffProfile?.workLocation ?? null },
      attendance: { status: classified.status, onLeave: classified.isOnLeave, leaveReason: leave?.reason ?? null, firstActivityAt: classified.record?.punchInAt ?? null, lastActivityAt: classified.record?.punchOutAt ?? null, workingHours: classified.workingHours, verifiedCalls: classified.verifiedCalls ?? null, dayNote: classified.dayNote ?? null, reportOnTime: classified.reportOnTime ?? null, fromVisits: classified.record?.fromVisits ?? false, officeCheckedIn: classified.record?.punchInLatitude != null, officeCheckedOut: classified.record?.punchOutLatitude != null },
      visits: visits.map((visit) => ({
        activityId: visit.id,
        stopId: visit.routeStop?.id ?? null,
        client: { id: visit.client.id, salonName: visit.client.salonName, city: visit.client.city, area: visit.client.area },
        checkInAt: visit.checkInAt,
        checkOutAt: visit.checkOutAt,
        outcome: visit.visitOutcome,
        distanceMeters: visit.visitProof?.distanceMeters ?? null,
        gpsVerified: visit.visitProof?.gpsVerified ?? null,
        latitude: visit.visitProof ? Number(visit.visitProof.checkInLatitude) : null,
        longitude: visit.visitProof ? Number(visit.visitProof.checkInLongitude) : null,
      })),
      notVisited: stops.filter((stop) => stop.status !== 'VISITED').map((stop) => ({ id: stop.id, status: stop.status, note: stop.note, salonName: stop.client.salonName, city: stop.client.city })),
      report: report ? {
        id: report.id,
        submittedAt: report.submittedAt,
        workingTown: report.workingTown,
        coworker: report.coworker?.name ?? null,
        noOrderReason: report.noOrderReason,
        tomorrowTown: report.tomorrowTown,
        tomorrowSalons: report.tomorrowRoute?.stops.map((stop) => stop.client.salonName) ?? [],
        tomorrowNewSalons: (report.tomorrowExtraStops as string[] | null) ?? [],
        summary: { calls: calls.length, orders: orders.length, value: orders.reduce((sum, call) => sum + (call.orderValue ?? 0), 0), newCalls: calls.filter((call) => call.customerType === 'NEW').length },
        calls,
      } : null,
    };
  }

  // ---- Area Sales Manager: a read-only view of their own team (the executives who report to them). Approvals stay with the admin.
  private ensureManager(actor: SessionUser) {
    if (!(actor.portal === 'STAFF' && actor.roles.some((item) => item.key === 'SALES_MANAGER'))) throw new ForbiddenException('The team view is for Area Sales Managers.');
  }

  private async teamMember(actor: SessionUser, staffId: string) {
    this.ensureManager(actor);
    const member = await this.prisma.user.findFirst({ where: { id: staffId, managerId: actor.id, roles: { some: { role: { key: { in: SALES_ROLES } } } } }, select: { id: true } });
    if (!member) throw new NotFoundException('This person is not in your team.');
  }

  async myTeam(actor: SessionUser) {
    this.ensureManager(actor);
    const key = istToday();
    const date = new Date(`${key}T00:00:00.000Z`);
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const members = await this.prisma.user.findMany({
      where: { managerId: actor.id, status: 'ACTIVE', roles: { some: { role: { key: { in: SALES_ROLES }, isActive: true } } } },
      select: { id: true, name: true, loginId: true, staffProfile: { select: { shiftStart: true, shiftEnd: true, isTechnician: true } }, roles: { select: { role: { select: { name: true, priority: true } } } } },
      orderBy: { name: 'asc' },
    });
    const ids = members.map((member) => member.id);
    const [days, sales, plans] = await Promise.all([
      this.attendance.classifyStaffOnDate(date, members),
      this.prisma.order.groupBy({ by: ['salespersonId'], where: { salespersonId: { in: ids }, ...countedOrders(start, end) }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.annualTargetPlan.findMany({ where: { staffId: { in: ids }, targetYear: year, isActive: true }, select: { id: true, staffId: true } }),
    ]);
    const targets = plans.length ? await this.prisma.target.findMany({ where: { annualPlanId: { in: plans.map((plan) => plan.id) }, period: 'MONTHLY', periodYear: year, periodIndex: month }, select: { annualPlanId: true, targetValue: true } }) : [];
    const items = members.map((member) => {
      const day = days.get(member.id)!;
      const total = sales.find((row) => row.salespersonId === member.id);
      const plan = plans.find((row) => row.staffId === member.id);
      const target = plan ? targets.find((row) => row.annualPlanId === plan.id) : undefined;
      const amount = Number(total?._sum.totalAmount ?? 0);
      const targetValue = target ? Number(target.targetValue) : null;
      return {
        staffId: member.id, name: member.name, loginId: member.loginId, roleName: role(member),
        status: day.status, verifiedCalls: day.verifiedCalls ?? 0, reportSubmitted: day.reportSubmitted ?? false, dayNote: day.dayNote ?? null,
        sales: amount, orders: total?._count ?? 0, target: targetValue, percent: targetValue ? Math.round((amount / targetValue) * 100) : null,
      };
    });
    const withTarget = items.filter((item) => item.target != null);
    return {
      date: key,
      period: { month, year },
      totals: {
        members: items.length,
        working: items.filter((item) => WORKING.has(item.status)).length,
        reportsSubmitted: items.filter((item) => item.reportSubmitted).length,
        verifiedCalls: items.reduce((sum, item) => sum + item.verifiedCalls, 0),
        sales: items.reduce((sum, item) => sum + item.sales, 0),
        target: withTarget.length ? withTarget.reduce((sum, item) => sum + (item.target ?? 0), 0) : null,
      },
      items,
    };
  }

  async myTeamMonth(actor: SessionUser, staffId: string, month?: number, year?: number) {
    await this.teamMember(actor, staffId);
    return this.attendance.monthlyFor(staffId, month, year);
  }

  async myTeamDay(actor: SessionUser, staffId: string, dateValue?: string) {
    await this.teamMember(actor, staffId);
    return this.staffDay(staffId, dateValue);
  }

  async myTeamCallPhoto(actor: SessionUser, callId: string) {
    this.ensureManager(actor);
    const call = await this.prisma.dailySalesCall.findFirst({ where: { id: callId, report: { staff: { managerId: actor.id } } }, select: { visitPhoto: true, photoMime: true } });
    if (!call) throw new NotFoundException('Call photo not found.');
    return { buffer: Buffer.from(call.visitPhoto), mime: call.photoMime };
  }

  async callPhoto(actor: SessionUser, callId: string) {
    this.ensureAdmin(actor);
    const call = await this.prisma.dailySalesCall.findUnique({ where: { id: callId }, select: { visitPhoto: true, photoMime: true } });
    if (!call) throw new NotFoundException('Call photo not found.');
    return { buffer: Buffer.from(call.visitPhoto), mime: call.photoMime };
  }

  async leads(actor: SessionUser, query: TeamLeadsQueryDto) {
    this.ensureAdmin(actor);
    const search = query.search?.trim();
    const scope: Prisma.LeadWhereInput = {
      ...(query.staffId ? { assignedToId: query.staffId } : {}),
      ...(search ? { OR: [{ salonName: { contains: search } }, { contactName: { contains: search } }, { phone: { contains: search } }, { city: { contains: search } }] } : {}),
    };
    const where: Prisma.LeadWhereInput = { ...scope, ...(query.status ? { status: query.status } : {}) };
    const [items, total, grouped] = await Promise.all([
      this.prisma.lead.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: { id: true, salonName: true, contactName: true, phone: true, city: true, area: true, source: true, status: true, nextActionAt: true, notes: true, createdAt: true, assignedTo: { select: { id: true, name: true } } } }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].map((status) => [status, grouped.find((row) => row.status === status)?._count._all ?? 0]));
    return { items, total, page: query.page, pageSize: query.pageSize, hasMore: query.page * query.pageSize < total, counts };
  }

  // Follow-ups, demos and samples across the team.
  async activities(actor: SessionUser, query: TeamActivitiesQueryDto) {
    this.ensureAdmin(actor);
    const search = query.search?.trim();
    const now = new Date();
    const base: Prisma.ClientActivityWhereInput = {
      type: query.type ?? { in: ['FOLLOW_UP', 'DEMO', 'SAMPLE'] },
      ...(query.staffId ? { OR: [{ assignedToId: query.staffId }, { createdById: query.staffId }] } : {}),
      ...(search ? { client: { salonName: { contains: search } } } : {}),
    };
    const scopes: Record<string, Prisma.ClientActivityWhereInput> = { open: { status: 'OPEN' }, overdue: { status: 'OPEN', scheduledAt: { lt: now } }, completed: { status: 'COMPLETED' }, all: {} };
    const scope = query.scope ?? 'open';
    const where: Prisma.ClientActivityWhereInput = { AND: [base, scopes[scope]!] };
    const [items, total, open, overdue, completed] = await Promise.all([
      this.prisma.clientActivity.findMany({
        where,
        orderBy: scope === 'completed' ? [{ completedAt: 'desc' }] : [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, type: true, status: true, purpose: true, note: true, nextAction: true, outcome: true, scheduledAt: true, completedAt: true, createdAt: true, client: { select: { id: true, salonName: true, city: true } }, createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
      }),
      this.prisma.clientActivity.count({ where }),
      this.prisma.clientActivity.count({ where: { AND: [base, scopes.open!] } }),
      this.prisma.clientActivity.count({ where: { AND: [base, scopes.overdue!] } }),
      this.prisma.clientActivity.count({ where: { AND: [base, scopes.completed!] } }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, hasMore: query.page * query.pageSize < total, counts: { open, overdue, completed } };
  }
}
