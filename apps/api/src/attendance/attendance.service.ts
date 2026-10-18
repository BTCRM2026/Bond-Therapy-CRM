import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CorrectionStatus, Department, LeaveStatus } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { dayReason, fieldDayStatus, FULL_DAY_CALLS, HALF_DAY_CALLS, reportCutoff } from '../day-rules/day-rules.js';
import { DayRulesService } from '../day-rules/day-rules.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminAttendanceListDto, HolidayDto, PunchDto, RequestCorrectionDto, ReviewRequestDto, UpdateOperationsSettingsDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const DAY_MS = 24 * 60 * 60 * 1000;

type DayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF' | 'NOT_PUNCHED' | 'IN_PROGRESS';
// Present when the field day rules apply: the verified calls and the report decide the day (see day-rules.ts).
type FieldRules = { dateKey: string; now: Date; verifiedCalls: number; reportSubmittedAt: Date | null };
type Classified = { status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean; verifiedCalls?: number; reportSubmitted?: boolean; reportOnTime?: boolean | null; dayNote?: string | null };

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly dayRules: DayRulesService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Attendance is not available to this account.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('This action is restricted to Super Admin.');
  }

  private ensureReviewerAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    throw new ForbiddenException('Reviewing requests is restricted to administrators.');
  }

  private todayKey() {
    const india = new Date(Date.now() + 330 * 60 * 1000);
    return new Date(Date.UTC(india.getUTCFullYear(), india.getUTCMonth(), india.getUTCDate()));
  }

  private indiaMinutes(value: Date) {
    const india = new Date(value.getTime() + 330 * 60 * 1000);
    return india.getUTCHours() * 60 + india.getUTCMinutes();
  }

  private dateKey(value: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!match) throw new BadRequestException('Invalid date. Use YYYY-MM-DD.');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new BadRequestException('Invalid date.');
    return date;
  }

  private async settings() {
    return (await this.prisma.operationsSettings.findUnique({ where: { id: 'default' } })) ?? { officeLatitude: null, officeLongitude: null, officeRadiusMeters: null, visitRadiusMeters: 150, lateThresholdMinutes: 15, halfDayThresholdHours: new Prisma.Decimal(4), weeklyOffDays: [0] as unknown as Prisma.JsonValue };
  }

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  private classifyDay(date: Date, record: { punchInAt: Date | null; punchOutAt: Date | null; fromVisits?: boolean; punchInLatitude?: unknown } | null, ctx: { shiftStart: string | null; shiftEnd: string | null; isHoliday: boolean; isOnLeave: boolean; isWeeklyOff: boolean; lateThresholdMinutes: number; halfDayThresholdHours: number; isFuture: boolean; rules?: FieldRules | null }): Classified {
    if (ctx.isHoliday) return { status: 'HOLIDAY' as DayStatus, workingHours: null as number | null, isLate: false, isEarlyCheckout: false };
    if (ctx.isWeeklyOff) return { status: 'WEEKLY_OFF' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
    if (ctx.isOnLeave) return { status: 'LEAVE' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
    const legacy = this.classifyByHours(record, ctx);
    if (ctx.rules) {
      const officeWork = record?.punchInLatitude != null && Boolean(record.punchInAt);
      const result = fieldDayStatus({ dateKey: ctx.rules.dateKey, now: ctx.rules.now, verifiedCalls: ctx.rules.verifiedCalls, reportSubmittedAt: ctx.rules.reportSubmittedAt, officeStatus: officeWork ? (legacy.status === 'HALF_DAY' ? 'HALF_DAY' : 'PRESENT') : null, hasActivity: Boolean(record?.punchInAt) || ctx.rules.verifiedCalls > 0 });
      return { status: result.status, workingHours: legacy.workingHours, isLate: officeWork ? legacy.isLate : false, isEarlyCheckout: legacy.isEarlyCheckout, verifiedCalls: result.verifiedCalls, reportSubmitted: result.reportSubmitted, reportOnTime: result.reportOnTime, dayNote: dayReason(result) };
    }
    return legacy;
  }

  // The original rule: the hours between the first and last activity decide present, late or half day.
  private classifyByHours(record: { punchInAt: Date | null; punchOutAt: Date | null; fromVisits?: boolean } | null, ctx: { shiftStart: string | null; shiftEnd: string | null; lateThresholdMinutes: number; halfDayThresholdHours: number; isFuture: boolean }): Classified {
    if (record?.punchInAt) {
      const workingHours = record.punchOutAt ? Math.round(((record.punchOutAt.getTime() - record.punchInAt.getTime()) / 3600000) * 100) / 100 : null;
      let isLate = false;
      // Field days recorded from salon visits have no fixed arrival time, so they are never late.
      if (ctx.shiftStart && !record.fromVisits) {
        const [h, m] = ctx.shiftStart.split(':').map(Number);
        const shiftStartMinutes = h * 60 + m;
        const punchInMinutes = this.indiaMinutes(record.punchInAt);
        isLate = punchInMinutes > shiftStartMinutes + ctx.lateThresholdMinutes;
      }
      let isEarlyCheckout = false;
      if (ctx.shiftEnd && record.punchOutAt) {
        const [h, m] = ctx.shiftEnd.split(':').map(Number);
        const shiftEndMinutes = h * 60 + m;
        const punchOutMinutes = this.indiaMinutes(record.punchOutAt);
        isEarlyCheckout = punchOutMinutes < shiftEndMinutes;
      }
      const status: DayStatus = workingHours !== null && workingHours < ctx.halfDayThresholdHours ? 'HALF_DAY' : isLate ? 'LATE' : 'PRESENT';
      return { status, workingHours, isLate, isEarlyCheckout };
    }
    if (ctx.isFuture) return { status: 'NOT_PUNCHED' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
    return { status: 'ABSENT' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
  }

  private async dayContext(userId: string, date: Date, settings: { weeklyOffDays: unknown }) {
    const [holiday, leave, profile] = await Promise.all([
      this.prisma.holiday.findUnique({ where: { date } }),
      this.prisma.leaveRequest.findFirst({ where: { userId, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } }),
      this.prisma.staffProfile.findUnique({ where: { userId }, select: { shiftStart: true, shiftEnd: true } }),
    ]);
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    return { isHoliday: Boolean(holiday), isOnLeave: Boolean(leave), isWeeklyOff: weeklyOffDays.includes(date.getUTCDay()), shiftStart: profile?.shiftStart ?? null, shiftEnd: profile?.shiftEnd ?? null };
  }

  async today(actor: SessionUser) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const dayStart = new Date(date.getTime() - 330 * 60 * 1000);
    const dayKey = date.toISOString().slice(0, 10);
    const [record, settings, visitCount, strictFrom, dayFacts, gate] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } }),
      this.settings(),
      this.prisma.clientActivity.count({ where: { createdById: actor.id, type: 'VISIT', checkInAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } } }),
      this.dayRules.strictFrom(),
      this.dayRules.facts([actor.id], date, new Date(date.getTime() + DAY_MS)),
      this.dayRules.gate(actor.id),
    ]);
    const facts = this.dayRules.factsFor(dayFacts, actor.id, dayKey);
    const rules = strictFrom && date.getTime() >= strictFrom.getTime() ? { dateKey: dayKey, now: new Date(), verifiedCalls: facts.verifiedCalls, reportSubmittedAt: facts.reportSubmittedAt } : null;
    const ctx = await this.dayContext(actor.id, date, settings);
    const classified = this.classifyDay(date, record, { ...ctx, lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: true, rules });
    return {
      punchInAt: record?.punchInAt ?? null,
      punchOutAt: record?.punchOutAt ?? null,
      punchInVerified: record?.punchInVerified ?? null,
      punchOutVerified: record?.punchOutVerified ?? null,
      // Office work is recorded with a GPS point; salon visits are recorded without one on the attendance row.
      officeCheckedIn: record?.punchInLatitude != null,
      officeCheckedOut: record?.punchOutLatitude != null,
      visitCount,
      halfDayThresholdHours: Number(settings.halfDayThresholdHours),
      ...classified,
      rulesApplied: Boolean(rules),
      rulesStartOn: strictFrom ? strictFrom.toISOString().slice(0, 10) : null,
      verifiedCalls: facts.verifiedCalls,
      fullDayCalls: FULL_DAY_CALLS,
      halfDayCalls: HALF_DAY_CALLS,
      reportSubmitted: Boolean(facts.reportSubmittedAt),
      reportDeadlineAt: reportCutoff(dayKey).toISOString(),
      gate,
    };
  }

  // Office work counts as a working day, so it must be recorded at the saved office location with a usable GPS fix.
  private async verifyOffice(dto: PunchDto) {
    const settings = await this.settings();
    if (settings.officeLatitude == null || settings.officeLongitude == null) throw new BadRequestException('The office location has not been set yet. Please ask an administrator to set it.');
    if (dto.latitude == null || dto.longitude == null) throw new BadRequestException('Allow location access to record office work.');
    if (dto.accuracy != null && dto.accuracy > 100) throw new BadRequestException(`Your GPS signal is too weak (about ${Math.round(dto.accuracy)} m off). Step outside or wait a few seconds, then try again.`);
    const radius = settings.officeRadiusMeters ?? 200;
    const distance = this.haversineMeters(Number(settings.officeLatitude), Number(settings.officeLongitude), dto.latitude, dto.longitude);
    if (distance > radius) throw new BadRequestException(`You are about ${distance} m from the office. Move within ${radius} m to record office work.`);
    return distance;
  }

  async punchIn(actor: SessionUser, dto: PunchDto, ipAddress?: string) {
    this.ensureAccess(actor);
    if (!this.isAdmin(actor)) await this.dayRules.assertCanStart(actor.id);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (existing?.punchInLatitude != null) throw new ConflictException('You have already checked in at the office today.');
    const distance = await this.verifyOffice(dto);
    const now = new Date();
    // Visits may already have opened the day; the earliest activity stays the start of the day.
    const start = existing?.punchInAt && existing.punchInAt < now ? existing.punchInAt : now;
    const record = await this.prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: actor.id, date } },
      create: { userId: actor.id, date, punchInAt: now, punchInLatitude: dto.latitude!, punchInLongitude: dto.longitude!, punchInVerified: true },
      update: { punchInAt: start, punchInLatitude: dto.latitude!, punchInLongitude: dto.longitude!, punchInVerified: true },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ATTENDANCE_PUNCH_IN', entity: 'ATTENDANCE_RECORD', entityId: record.id, details: { verified: true, distance, kind: 'OFFICE' }, ipAddress });
    return this.today(actor);
  }

  async punchOut(actor: SessionUser, dto: PunchDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (existing?.punchInLatitude == null) throw new ConflictException('Check in at the office before you check out.');
    if (existing.punchOutLatitude != null) throw new ConflictException('You have already checked out of the office today.');
    const distance = await this.verifyOffice(dto);
    const now = new Date();
    const end = existing.punchOutAt && existing.punchOutAt > now ? existing.punchOutAt : now;
    const record = await this.prisma.attendanceRecord.update({ where: { userId_date: { userId: actor.id, date } }, data: { punchOutAt: end, punchOutLatitude: dto.latitude!, punchOutLongitude: dto.longitude!, punchOutVerified: true } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ATTENDANCE_PUNCH_OUT', entity: 'ATTENDANCE_RECORD', entityId: record.id, details: { verified: true, distance, kind: 'OFFICE' }, ipAddress });
    return this.today(actor);
  }

  async monthly(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureAccess(actor);
    return this.monthlyFor(actor.id, monthParam, yearParam);
  }

  async monthlyFor(userId: string, monthParam?: number, yearParam?: number) {
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const today = this.todayKey();
    const [records, settings, holidays, leaves, profile, strictFrom, facts] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
      this.settings(),
      this.prisma.holiday.findMany({ where: { date: { gte: start, lt: end } } }),
      this.prisma.leaveRequest.findMany({ where: { userId, status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } } }),
      this.prisma.staffProfile.findUnique({ where: { userId }, select: { shiftStart: true, shiftEnd: true } }),
      this.dayRules.strictFrom(),
      this.dayRules.facts([userId], start, end),
    ]);
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    const holidayDates = new Set(holidays.map((h) => h.date.getTime()));
    const days: Array<Classified & { date: string; punchInAt: string | null; punchOutAt: string | null }> = [];
    const lastDay = Math.min(end.getTime() - DAY_MS, today.getTime() < end.getTime() ? today.getTime() : end.getTime() - DAY_MS);
    for (let cursor = start.getTime(); cursor <= lastDay; cursor += DAY_MS) {
      const date = new Date(cursor);
      const record = records.find((r) => r.date.getTime() === cursor) ?? null;
      const isOnLeave = leaves.some((leave) => leave.startDate.getTime() <= cursor && leave.endDate.getTime() >= cursor);
      const dayKey = date.toISOString().slice(0, 10);
      const dayFacts = this.dayRules.factsFor(facts, userId, dayKey);
      const rules = strictFrom && cursor >= strictFrom.getTime() ? { dateKey: dayKey, now, verifiedCalls: dayFacts.verifiedCalls, reportSubmittedAt: dayFacts.reportSubmittedAt } : null;
      const classified = this.classifyDay(date, record, { shiftStart: profile?.shiftStart ?? null, shiftEnd: profile?.shiftEnd ?? null, isHoliday: holidayDates.has(cursor), isOnLeave, isWeeklyOff: weeklyOffDays.includes(date.getUTCDay()), lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: cursor === today.getTime(), rules });
      days.push({ date: date.toISOString(), punchInAt: record?.punchInAt?.toISOString() ?? null, punchOutAt: record?.punchOutAt?.toISOString() ?? null, ...classified });
    }
    const daysPresent = days.filter((d) => d.status === 'PRESENT' || d.status === 'LATE').length;
    const summary = {
      present: days.filter((d) => d.status === 'PRESENT' || d.status === 'LATE').length,
      late: days.filter((d) => d.isLate).length,
      halfDay: days.filter((d) => d.status === 'HALF_DAY').length,
      absent: days.filter((d) => d.status === 'ABSENT').length,
      leave: days.filter((d) => d.status === 'LEAVE').length,
      holiday: days.filter((d) => d.status === 'HOLIDAY').length,
      weeklyOff: days.filter((d) => d.status === 'WEEKLY_OFF').length,
      earlyCheckout: days.filter((d) => d.isEarlyCheckout).length,
      totalHours: Math.round(days.reduce((sum, d) => sum + (d.workingHours ?? 0), 0) * 100) / 100,
    };
    return { period: { month, year }, daysPresent, summary, records: days.filter((d) => d.punchInAt || d.status !== 'WEEKLY_OFF').map((d) => ({ date: d.date, punchInAt: d.punchInAt, punchOutAt: d.punchOutAt, status: d.status, workingHours: d.workingHours, isLate: d.isLate, isEarlyCheckout: d.isEarlyCheckout, verifiedCalls: d.verifiedCalls ?? null, dayNote: d.dayNote ?? null })).reverse() };
  }

  async requestCorrection(actor: SessionUser, dto: RequestCorrectionDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.dateKey(dto.date);
    if (!dto.requestedPunchIn && !dto.requestedPunchOut) throw new BadRequestException('Enter a requested punch-in or punch-out time.');
    const request = await this.prisma.attendanceCorrectionRequest.create({
      data: { userId: actor.id, date, requestedPunchIn: dto.requestedPunchIn ? new Date(dto.requestedPunchIn) : null, requestedPunchOut: dto.requestedPunchOut ? new Date(dto.requestedPunchOut) : null, reason: dto.reason.trim() },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ATTENDANCE_CORRECTION_REQUEST', entity: 'ATTENDANCE_CORRECTION_REQUEST', entityId: request.id, details: { date: dto.date }, ipAddress });
    return request;
  }

  async myCorrectionRequests(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.attendanceCorrectionRequest.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async listCorrectionRequests(actor: SessionUser, status?: string) {
    this.ensureReviewerAccess(actor);
    const where: Prisma.AttendanceCorrectionRequestWhereInput = {};
    if (status) where.status = status as CorrectionStatus;
    return this.prisma.attendanceCorrectionRequest.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async reviewCorrection(actor: SessionUser, id: string, dto: ReviewRequestDto, ipAddress?: string) {
    this.ensureReviewerAccess(actor);
    const request = await this.prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Correction request not found.');
    if (request.status !== 'PENDING') throw new BadRequestException('This request has already been reviewed.');
    const updated = await this.prisma.attendanceCorrectionRequest.update({ where: { id }, data: { status: dto.status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: dto.reviewNote?.trim() || null } });
    if (dto.status === 'APPROVED') {
      await this.prisma.attendanceRecord.upsert({
        where: { userId_date: { userId: request.userId, date: request.date } },
        create: { userId: request.userId, date: request.date, punchInAt: request.requestedPunchIn, punchOutAt: request.requestedPunchOut },
        update: { punchInAt: request.requestedPunchIn ?? undefined, punchOutAt: request.requestedPunchOut ?? undefined },
      });
    }
    await recordAudit(this.prisma, { actorId: actor.id, action: dto.status === 'APPROVED' ? 'ATTENDANCE_CORRECTION_APPROVE' : 'ATTENDANCE_CORRECTION_REJECT', entity: 'ATTENDANCE_CORRECTION_REQUEST', entityId: id, details: { userId: request.userId }, ipAddress });
    return updated;
  }

  async myLeaveRequests(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.leaveRequest.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async listLeaveRequests(actor: SessionUser, status?: string) {
    this.ensureReviewerAccess(actor);
    const where: Prisma.LeaveRequestWhereInput = {};
    if (status) where.status = status as LeaveStatus;
    return this.prisma.leaveRequest.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async listHolidays(actor: SessionUser) {
    this.ensureAccess(actor);
    const now = new Date();
    return this.prisma.holiday.findMany({ where: { date: { gte: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) } }, orderBy: { date: 'asc' } });
  }

  async createHoliday(actor: SessionUser, dto: HolidayDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const date = this.dateKey(dto.date);
    const holiday = await this.prisma.holiday.upsert({ where: { date }, create: { date, name: dto.name.trim(), createdById: actor.id }, update: { name: dto.name.trim() } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HOLIDAY_CREATE', entity: 'HOLIDAY', entityId: holiday.id, details: { date: dto.date, name: dto.name }, ipAddress });
    return holiday;
  }

  async deleteHoliday(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Holiday not found.');
    await this.prisma.holiday.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'HOLIDAY_DELETE', entity: 'HOLIDAY', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  async getSettings(actor: SessionUser) {
    this.ensureAdminAccess(actor);
    const settings = await this.settings();
    return { ...settings, officeLatitude: settings.officeLatitude != null ? Number(settings.officeLatitude) : null, officeLongitude: settings.officeLongitude != null ? Number(settings.officeLongitude) : null, halfDayThresholdHours: Number(settings.halfDayThresholdHours) };
  }

  async updateSettings(actor: SessionUser, dto: UpdateOperationsSettingsDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const data: Prisma.OperationsSettingsUpdateInput = { updatedBy: { connect: { id: actor.id } } };
    if (dto.officeLatitude !== undefined) data.officeLatitude = dto.officeLatitude;
    if (dto.officeLongitude !== undefined) data.officeLongitude = dto.officeLongitude;
    if (dto.officeRadiusMeters !== undefined) data.officeRadiusMeters = dto.officeRadiusMeters;
    if (dto.visitRadiusMeters !== undefined) data.visitRadiusMeters = dto.visitRadiusMeters;
    if (dto.lateThresholdMinutes !== undefined) data.lateThresholdMinutes = dto.lateThresholdMinutes;
    if (dto.halfDayThresholdHours !== undefined) data.halfDayThresholdHours = dto.halfDayThresholdHours;
    if (dto.weeklyOffDays !== undefined) data.weeklyOffDays = dto.weeklyOffDays;
    const settings = await this.prisma.operationsSettings.upsert({ where: { id: 'default' }, create: { id: 'default', updatedById: actor.id, officeLatitude: dto.officeLatitude, officeLongitude: dto.officeLongitude, officeRadiusMeters: dto.officeRadiusMeters, visitRadiusMeters: dto.visitRadiusMeters, lateThresholdMinutes: dto.lateThresholdMinutes, halfDayThresholdHours: dto.halfDayThresholdHours, weeklyOffDays: dto.weeklyOffDays }, update: data });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'OPERATIONS_SETTINGS_UPDATE', entity: 'OPERATIONS_SETTINGS', entityId: settings.id, details: dto, ipAddress });
    return this.getSettings(actor);
  }

  async adminToday(actor: SessionUser) {
    this.ensureAdminAccess(actor);
    const staff = await this.prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } }, select: { id: true, staffProfile: { select: { shiftStart: true, shiftEnd: true } } } });
    const date = this.todayKey();
    const [days, holiday, settings] = await Promise.all([this.classifyStaffOnDate(date, staff), this.prisma.holiday.findUnique({ where: { date } }), this.settings()]);
    const isWeeklyOff = ((settings.weeklyOffDays as number[] | null) ?? [0]).includes(date.getUTCDay());
    let present = 0; let late = 0; let onLeave = 0; let notPunched = 0;
    if (!holiday && !isWeeklyOff) {
      for (const member of staff) {
        const day = days.get(member.id)!;
        if (day.isOnLeave) onLeave++;
        else if (day.status === 'NOT_PUNCHED' || day.status === 'ABSENT') notPunched++;
        else { present++; if (day.isLate) late++; }
      }
    }
    return { total: staff.length, present, late, onLeave, notPunched, isHoliday: Boolean(holiday), isWeeklyOff, holidayName: holiday?.name ?? null };
  }

  // The day-start block: who cannot begin today until an administrator approves them, and the approval itself.
  async dayGate(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.dayRules.gate(actor.id);
  }

  async blockedStaff(actor: SessionUser) {
    this.ensureAdminAccess(actor);
    return this.dayRules.blockedToday();
  }

  async approveDayStart(actor: SessionUser, userId: string, note?: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    return this.dayRules.approveStart(actor, userId, note, ipAddress);
  }

  // Day status for several staff on one date. Shared by the admin attendance list and the team activity board, so both always agree.
  async classifyStaffOnDate(date: Date, staff: Array<{ id: string; staffProfile: { shiftStart: string | null; shiftEnd: string | null } | null }>) {
    const settings = await this.settings();
    const ids = staff.map((member) => member.id);
    const [records, holiday, leaves, strictFrom, facts] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId: { in: ids }, date } }),
      this.prisma.holiday.findUnique({ where: { date } }),
      this.prisma.leaveRequest.findMany({ where: { userId: { in: ids }, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } }),
      this.dayRules.strictFrom(),
      this.dayRules.facts(ids, date, new Date(date.getTime() + DAY_MS)),
    ]);
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    const dayKey = date.toISOString().slice(0, 10);
    const now = new Date();
    return new Map(staff.map((member) => {
      const record = records.find((item) => item.userId === member.id) ?? null;
      const isOnLeave = leaves.some((item) => item.userId === member.id);
      const dayFacts = this.dayRules.factsFor(facts, member.id, dayKey);
      const rules = strictFrom && date.getTime() >= strictFrom.getTime() ? { dateKey: dayKey, now, verifiedCalls: dayFacts.verifiedCalls, reportSubmittedAt: dayFacts.reportSubmittedAt } : null;
      const classified = this.classifyDay(date, record, { shiftStart: member.staffProfile?.shiftStart ?? null, shiftEnd: member.staffProfile?.shiftEnd ?? null, isHoliday: Boolean(holiday), isOnLeave, isWeeklyOff: weeklyOffDays.includes(date.getUTCDay()), lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: date.getTime() >= this.todayKey().getTime(), rules });
      return [member.id, { record, isOnLeave, ...classified }] as const;
    }));
  }

  async adminList(actor: SessionUser, query: AdminAttendanceListDto) {
    this.ensureAdminAccess(actor);
    const date = query.date ? this.dateKey(query.date) : this.todayKey();
    const staffWhere: Prisma.UserWhereInput = { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } };
    if (query.department) staffWhere.department = query.department as Department;
    if (query.search) staffWhere.OR = [{ name: { contains: query.search } }, { loginId: { contains: query.search } }];
    const staff = await this.prisma.user.findMany({ where: staffWhere, select: { id: true, name: true, department: true, loginId: true, staffProfile: { select: { shiftStart: true, shiftEnd: true } } }, orderBy: { name: 'asc' } });
    const days = await this.classifyStaffOnDate(date, staff);
    const filteredRows = staff.map((member) => {
      const { record, isOnLeave: _isOnLeave, ...classified } = days.get(member.id)!;
      return { id: member.id, name: member.name, loginId: member.loginId, department: member.department, punchInAt: record?.punchInAt?.toISOString() ?? null, punchOutAt: record?.punchOutAt?.toISOString() ?? null, ...classified };
    }).filter((row) => !query.status || row.status === query.status);
    const total = filteredRows.length;
    const items = filteredRows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize);
    return { date: date.toISOString(), items, page: query.page, pageSize: query.pageSize, total };
  }

  async employeeProfile(actor: SessionUser, userId: string, monthParam?: number, yearParam?: number) {
    this.ensureAdminAccess(actor);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, loginId: true, department: true, staffProfile: { select: { employeeCode: true, jobTitle: true, shiftStart: true, shiftEnd: true } } } });
    if (!user) throw new NotFoundException('Employee not found.');
    const monthly = await this.monthlyFor(userId, monthParam, yearParam);
    return { user, ...monthly };
  }
}
