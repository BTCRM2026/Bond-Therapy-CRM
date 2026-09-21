import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAccess(actor: SessionUser) {
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Attendance is not available to this account.');
  }

  private todayKey() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  async today(actor: SessionUser) {
    this.ensureAccess(actor);
    const record = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date: this.todayKey() } } });
    return record;
  }

  async punchIn(actor: SessionUser) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (existing?.punchInAt) throw new ConflictException('You have already punched in today.');
    return this.prisma.attendanceRecord.upsert({
      where: { userId_date: { userId: actor.id, date } },
      create: { userId: actor.id, date, punchInAt: new Date() },
      update: { punchInAt: new Date() },
    });
  }

  async punchOut(actor: SessionUser) {
    this.ensureAccess(actor);
    const date = this.todayKey();
    const existing = await this.prisma.attendanceRecord.findUnique({ where: { userId_date: { userId: actor.id, date } } });
    if (!existing?.punchInAt) throw new ConflictException('Punch in before you punch out.');
    if (existing.punchOutAt) throw new ConflictException('You have already punched out today.');
    return this.prisma.attendanceRecord.update({ where: { userId_date: { userId: actor.id, date } }, data: { punchOutAt: new Date() } });
  }

  async monthly(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureAccess(actor);
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const records = await this.prisma.attendanceRecord.findMany({ where: { userId: actor.id, date: { gte: start, lt: end } }, orderBy: { date: 'asc' } });
    const daysPresent = records.filter((record) => record.punchInAt).length;
    return { period: { month, year }, daysPresent, records };
  }
}
