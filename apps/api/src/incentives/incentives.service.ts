import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GenerateIncentiveDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);

@Injectable()
export class IncentivesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Incentives are not available to this account.');
  }

  private isManager(actor: SessionUser) {
    return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'SALES_MANAGER');
  }

  private ensureManagerAccess(actor: SessionUser) {
    if (this.isAdmin(actor) || this.isManager(actor)) return;
    throw new ForbiddenException('Setting incentive rates is restricted to Sales Managers.');
  }

  private monthRange(month: number, year: number) {
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  private async eligibleRevenueFor(userId: string, month: number, year: number) {
    const { start, end } = this.monthRange(month, year);
    const aggregate = await this.prisma.order.aggregate({ where: { salespersonId: userId, createdAt: { gte: start, lt: end }, status: { in: ['APPROVED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'] } }, _sum: { totalAmount: true } });
    return Number(aggregate._sum.totalAmount ?? 0);
  }

  async me(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureAccess(actor);
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const statement = await this.prisma.incentiveStatement.findUnique({ where: { userId_periodYear_periodMonth: { userId: actor.id, periodYear: year, periodMonth: month } }, include: { approvedBy: { select: { id: true, name: true } } } });
    if (statement) return { period: { month, year }, generated: true, ...statement, ratePercent: Number(statement.ratePercent), eligibleRevenue: Number(statement.eligibleRevenue), incentiveAmount: Number(statement.incentiveAmount) };
    const eligibleRevenue = await this.eligibleRevenueFor(actor.id, month, year);
    return { period: { month, year }, generated: false, ratePercent: null, eligibleRevenue, incentiveAmount: null, status: null, approvedBy: null, approvedAt: null };
  }

  async teamOverview(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureManagerAccess(actor);
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const team = this.isAdmin(actor)
      ? await this.prisma.user.findMany({ where: { roles: { some: { role: { key: 'SALES_EXECUTIVE' } } } }, select: { id: true, name: true } })
      : await this.prisma.user.findMany({ where: { managerId: actor.id }, select: { id: true, name: true } });
    const statements = await this.prisma.incentiveStatement.findMany({ where: { userId: { in: team.map((member) => member.id) }, periodYear: year, periodMonth: month } });
    const rows = await Promise.all(team.map(async (member) => {
      const statement = statements.find((row) => row.userId === member.id);
      const eligibleRevenue = statement ? Number(statement.eligibleRevenue) : await this.eligibleRevenueFor(member.id, month, year);
      return {
        userId: member.id, name: member.name, eligibleRevenue,
        ratePercent: statement ? Number(statement.ratePercent) : null,
        incentiveAmount: statement ? Number(statement.incentiveAmount) : null,
        status: statement?.status ?? null,
        statementId: statement?.id ?? null,
      };
    }));
    return { period: { month, year }, rows };
  }

  async generate(actor: SessionUser, dto: GenerateIncentiveDto, ipAddress?: string) {
    this.ensureManagerAccess(actor);
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: dto.userId, managerId: actor.id }, select: { id: true } });
      if (!member) throw new ForbiddenException('You can only set incentives for your own team.');
    }
    const eligibleRevenue = await this.eligibleRevenueFor(dto.userId, dto.periodMonth, dto.periodYear);
    const incentiveAmount = Math.round((eligibleRevenue * dto.ratePercent) / 100);
    const statement = await this.prisma.incentiveStatement.upsert({
      where: { userId_periodYear_periodMonth: { userId: dto.userId, periodYear: dto.periodYear, periodMonth: dto.periodMonth } },
      create: { userId: dto.userId, periodMonth: dto.periodMonth, periodYear: dto.periodYear, ratePercent: dto.ratePercent, eligibleRevenue, incentiveAmount, status: 'PENDING' },
      update: { ratePercent: dto.ratePercent, eligibleRevenue, incentiveAmount, status: 'PENDING', approvedById: null, approvedAt: null },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_GENERATE', entity: 'INCENTIVE_STATEMENT', entityId: statement.id, details: { userId: dto.userId, period: `${dto.periodYear}-${dto.periodMonth}`, ratePercent: dto.ratePercent }, ipAddress });
    return statement;
  }

  async approve(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureManagerAccess(actor);
    const statement = await this.prisma.incentiveStatement.findUnique({ where: { id } });
    if (!statement) throw new NotFoundException('Incentive statement not found.');
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: statement.userId, managerId: actor.id }, select: { id: true } });
      if (!member) throw new ForbiddenException('You can only approve incentives for your own team.');
    }
    const updated = await this.prisma.incentiveStatement.update({ where: { id }, data: { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date() } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_APPROVE', entity: 'INCENTIVE_STATEMENT', entityId: id, details: { userId: statement.userId }, ipAddress });
    return updated;
  }
}
