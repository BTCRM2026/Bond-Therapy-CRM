import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CorrectionStatus, Department, LeaveStatus } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminAttendanceListDto, HolidayDto, PunchDto, RequestCorrectionDto, RequestLeaveDto, ReviewRequestDto, UpdateOperationsSettingsDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const DAY_MS = 24 * 60 * 60 * 1000;

type DayStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'HOLIDAY' | 'WEEKLY_OFF' | 'NOT_PUNCHED';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

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

  private isManager(actor: SessionUser) {
    return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'SALES_MANAGER');
  }

  private ensureReviewerAccess(actor: SessionUser) {
    if (this.isAdmin(actor) || this.isManager(actor)) return;
    throw new ForbiddenException('Reviewing requests is restricted to Sales Managers and Super Admin.');
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

  private classifyDay(date: Date, record: { punchInAt: Date | null; punchOutAt: Date | null } | null, ctx: { shiftStart: string | null; shiftEnd: string | null; isHoliday: boolean; isOnLeave: boolean; isWeeklyOff: boolean; lateThresholdMinutes: number; halfDayThresholdHours: number; isFuture: boolean }) {
    if (ctx.isHoliday) return { status: 'HOLIDAY' as DayStatus, workingHours: null as number | null, isLate: false, isEarlyCheckout: false };
    if (ctx.isWeeklyOff) return { status: 'WEEKLY_OFF' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
    if (ctx.isOnLeave) return { status: 'LEAVE' as DayStatus, workingHours: null, isLate: false, isEarlyCheckout: false };
    if (record?.punchInAt) {
      const workingHours = record.punchOutAt ? Math.round(((record.punchOutAt.getTime() - record.punchInAt.getTime()) / 3600000) * 100) / 100 : null;
      let isLate = false;
      if (ctx.shiftStart) {
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
    const [record, settings] = await Promise.all([this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } }), this.settings()]);
    const ctx = await this.dayContext(actor.id, date, settings);
    const classified = this.classifyDay(date, record, { ...ctx, lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: true });
    return { punchInAt: record?.punchInAt ?? null, punchOutAt: record?.punchOutAt ?? null, punchInVerified: record?.punchInVerified ?? null, punchOutVerified: record?.punchOutVerified ?? null, ...classified };
  }

  async punchIn(actor: SessionUser, dto: PunchDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (existing?.punchInAt) throw new ConflictException('You have already punched in today.');
    const settings = await this.settings();
    let verified: boolean | null = null;
    let distance: number | null = null;
    if (settings.officeLatitude != null && settings.officeLongitude != null && dto.latitude != null && dto.longitude != null) {
      distance = this.haversineMeters(Number(settings.officeLatitude), Number(settings.officeLongitude), dto.latitude, dto.longitude);
      verified = distance <= (settings.officeRadiusMeters ?? 500);
    }
    const record = await this.prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: actor.id, date } },
      create: { userId: actor.id, date, punchInAt: new Date(), punchInLatitude: dto.latitude ?? null, punchInLongitude: dto.longitude ?? null, punchInVerified: verified },
      update: { punchInAt: new Date(), punchInLatitude: dto.latitude ?? null, punchInLongitude: dto.longitude ?? null, punchInVerified: verified },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ATTENDANCE_PUNCH_IN', entity: 'ATTENDANCE_RECORD', entityId: record.id, details: { verified, distance }, ipAddress });
    return this.today(actor);
  }

  async punchOut(actor: SessionUser, dto: PunchDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (!existing?.punchInAt) throw new ConflictException('Punch in before you punch out.');
    if (existing.punchOutAt) throw new ConflictException('You have already punched out today.');
    const settings = await this.settings();
    let verified: boolean | null = null;
    if (settings.officeLatitude != null && settings.officeLongitude != null && dto.latitude != null && dto.longitude != null) {
      const distance = this.haversineMeters(Number(settings.officeLatitude), Number(settings.officeLongitude), dto.latitude, dto.longitude);
      verified = distance <= (settings.officeRadiusMeters ?? 500);
    }
    const record = await this.prisma.attendanceRecord.update({ where: { userId_date: { userId: actor.id, date } }, data: { punchOutAt: new Date(), punchOutLatitude: dto.latitude ?? null, punchOutLongitude: dto.longitude ?? null, punchOutVerified: verified } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ATTENDANCE_PUNCH_OUT', entity: 'ATTENDANCE_RECORD', entityId: record.id, details: { verified }, ipAddress });
    return this.today(actor);
  }

  async monthly(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureAccess(actor);
    return this.monthlyFor(actor.id, monthParam, yearParam);
  }

  private async monthlyFor(userId: string, monthParam?: number, yearParam?: number) {
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const today = this.todayKey();
    const [records, settings, holidays, leaves, profile] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } }),
      this.settings(),
      this.prisma.holiday.findMany({ where: { date: { gte: start, lt: end } } }),
      this.prisma.leaveRequest.findMany({ where: { userId, status: 'APPROVED', startDate: { lt: end }, endDate: { gte: start } } }),
      this.prisma.staffProfile.findUnique({ where: { userId }, select: { shiftStart: true, shiftEnd: true } }),
    ]);
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    const holidayDates = new Set(holidays.map((h) => h.date.getTime()));
    const days: Array<{ date: string; punchInAt: string | null; punchOutAt: string | null; status: DayStatus; workingHours: number | null; isLate: boolean; isEarlyCheckout: boolean }> = [];
    const lastDay = Math.min(end.getTime() - DAY_MS, today.getTime() < end.getTime() ? today.getTime() : end.getTime() - DAY_MS);
    for (let cursor = start.getTime(); cursor <= lastDay; cursor += DAY_MS) {
      const date = new Date(cursor);
      const record = records.find((r) => r.date.getTime() === cursor) ?? null;
      const isOnLeave = leaves.some((leave) => leave.startDate.getTime() <= cursor && leave.endDate.getTime() >= cursor);
      const classified = this.classifyDay(date, record, { shiftStart: profile?.shiftStart ?? null, shiftEnd: profile?.shiftEnd ?? null, isHoliday: holidayDates.has(cursor), isOnLeave, isWeeklyOff: weeklyOffDays.includes(date.getUTCDay()), lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: cursor === today.getTime() });
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
    return { period: { month, year }, daysPresent, summary, records: days.filter((d) => d.punchInAt || d.status !== 'WEEKLY_OFF').map((d) => ({ date: d.date, punchInAt: d.punchInAt, punchOutAt: d.punchOutAt, status: d.status, workingHours: d.workingHours, isLate: d.isLate, isEarlyCheckout: d.isEarlyCheckout })).reverse() };
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
    if (!this.isAdmin(actor)) where.user = { managerId: actor.id };
    return this.prisma.attendanceCorrectionRequest.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async reviewCorrection(actor: SessionUser, id: string, dto: ReviewRequestDto, ipAddress?: string) {
    this.ensureReviewerAccess(actor);
    const request = await this.prisma.attendanceCorrectionRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Correction request not found.');
    if (request.status !== 'PENDING') throw new BadRequestException('This request has already been reviewed.');
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: request.userId, managerId: actor.id } });
      if (!member) throw new ForbiddenException('You can only review requests for your own team.');
    }
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

  async requestLeave(actor: SessionUser, dto: RequestLeaveDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const startDate = this.dateKey(dto.startDate);
    const endDate = this.dateKey(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('End date must be on or after the start date.');
    const request = await this.prisma.leaveRequest.create({ data: { userId: actor.id, startDate, endDate, reason: dto.reason.trim() } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAVE_REQUEST', entity: 'LEAVE_REQUEST', entityId: request.id, details: { startDate: dto.startDate, endDate: dto.endDate }, ipAddress });
    return request;
  }

  async myLeaveRequests(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.leaveRequest.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async listLeaveRequests(actor: SessionUser, status?: string) {
    this.ensureReviewerAccess(actor);
    const where: Prisma.LeaveRequestWhereInput = {};
    if (status) where.status = status as LeaveStatus;
    if (!this.isAdmin(actor)) where.user = { managerId: actor.id };
    return this.prisma.leaveRequest.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async reviewLeave(actor: SessionUser, id: string, dto: ReviewRequestDto, ipAddress?: string) {
    this.ensureReviewerAccess(actor);
    const request = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'PENDING') throw new BadRequestException('This request has already been reviewed.');
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: request.userId, managerId: actor.id } });
      if (!member) throw new ForbiddenException('You can only review requests for your own team.');
    }
    const updated = await this.prisma.leaveRequest.update({ where: { id }, data: { status: dto.status, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: dto.reviewNote?.trim() || null } });
    await recordAudit(this.prisma, { actorId: actor.id, action: dto.status === 'APPROVED' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT', entity: 'LEAVE_REQUEST', entityId: id, details: { userId: request.userId }, ipAddress });
    return updated;
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
    const settings = await this.settings();
    const [records, holiday] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId: { in: staff.map((s) => s.id) }, date } }),
      this.prisma.holiday.findUnique({ where: { date } }),
    ]);
    const leaves = await this.prisma.leaveRequest.findMany({ where: { userId: { in: staff.map((s) => s.id) }, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } });
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    const isWeeklyOff = weeklyOffDays.includes(date.getUTCDay());
    let present = 0; let late = 0; let onLeave = 0; let notPunched = 0;
    for (const member of staff) {
      const record = records.find((r) => r.userId === member.id);
      if (holiday || isWeeklyOff) continue;
      if (leaves.some((l) => l.userId === member.id)) { onLeave++; continue; }
      if (record?.punchInAt) {
        const classified = this.classifyDay(date, record, { shiftStart: member.staffProfile?.shiftStart ?? null, shiftEnd: member.staffProfile?.shiftEnd ?? null, isHoliday: false, isOnLeave: false, isWeeklyOff: false, lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: true });
        present++;
        if (classified.isLate) late++;
      } else { notPunched++; }
    }
    return { total: staff.length, present, late, onLeave, notPunched, isHoliday: Boolean(holiday), isWeeklyOff, holidayName: holiday?.name ?? null };
  }

  async adminList(actor: SessionUser, query: AdminAttendanceListDto) {
    this.ensureAdminAccess(actor);
    const date = query.date ? this.dateKey(query.date) : this.todayKey();
    const staffWhere: Prisma.UserWhereInput = { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } };
    if (query.department) staffWhere.department = query.department as Department;
    if (query.search) staffWhere.OR = [{ name: { contains: query.search } }, { loginId: { contains: query.search } }];
    const staff = await this.prisma.user.findMany({ where: staffWhere, select: { id: true, name: true, department: true, loginId: true, staffProfile: { select: { shiftStart: true, shiftEnd: true } } }, orderBy: { name: 'asc' } });
    const settings = await this.settings();
    const [records, holiday, leaves] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { userId: { in: staff.map((s) => s.id) }, date } }),
      this.prisma.holiday.findUnique({ where: { date } }),
      this.prisma.leaveRequest.findMany({ where: { userId: { in: staff.map((s) => s.id) }, status: 'APPROVED', startDate: { lte: date }, endDate: { gte: date } } }),
    ]);
    const weeklyOffDays = (settings.weeklyOffDays as number[] | null) ?? [0];
    const filteredRows = staff.map((member) => {
      const record = records.find((r) => r.userId === member.id) ?? null;
      const isOnLeave = leaves.some((l) => l.userId === member.id);
      const classified = this.classifyDay(date, record, { shiftStart: member.staffProfile?.shiftStart ?? null, shiftEnd: member.staffProfile?.shiftEnd ?? null, isHoliday: Boolean(holiday), isOnLeave, isWeeklyOff: weeklyOffDays.includes(date.getUTCDay()), lateThresholdMinutes: settings.lateThresholdMinutes, halfDayThresholdHours: Number(settings.halfDayThresholdHours), isFuture: date.getTime() >= this.todayKey().getTime() });
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
