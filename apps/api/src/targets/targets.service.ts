import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TargetMetric } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListTargetsDto, TargetDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const fulfilmentStatuses = ['APPROVED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'FORWARDED_TO_DISTRIBUTOR', 'DISTRIBUTOR_FULFILLED'] as const;
const productiveOutcomes = ['PRODUCTIVE', 'ORDER_GENERATED', 'QUOTATION_REQUIRED'] as const;

@Injectable()
export class TargetsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Performance data is not available to this account.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Managing targets is restricted to Super Admin.');
  }

  private monthRange(month: number, year: number) {
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  async list(actor: SessionUser, query: ListTargetsDto) {
    this.ensureAdminAccess(actor);
    const where: Prisma.TargetWhereInput = {};
    if (query.period) where.period = query.period;
    if (query.periodYear) where.periodYear = query.periodYear;
    if (query.periodIndex) where.periodIndex = query.periodIndex;
    if (query.scope) where.scope = query.scope;
    const targets = await this.prisma.target.findMany({ where, orderBy: [{ periodYear: 'desc' }, { periodIndex: 'desc' }, { metric: 'asc' }] });
    const staffIds = targets.filter((t) => t.scope === 'STAFF').map((t) => t.scopeId);
    const territoryIds = targets.filter((t) => t.scope === 'TERRITORY').map((t) => t.scopeId);
    const regionIds = targets.filter((t) => t.scope === 'REGION').map((t) => t.scopeId);
    const [staff, territories, regions] = await Promise.all([
      staffIds.length ? this.prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [],
      territoryIds.length ? this.prisma.territory.findMany({ where: { id: { in: territoryIds } }, select: { id: true, name: true } }) : [],
      regionIds.length ? this.prisma.region.findMany({ where: { id: { in: regionIds } }, select: { id: true, name: true } }) : [],
    ]);
    const nameFor = (scope: string, scopeId: string) => (scope === 'STAFF' ? staff.find((s) => s.id === scopeId)?.name : scope === 'TERRITORY' ? territories.find((t) => t.id === scopeId)?.name : regions.find((r) => r.id === scopeId)?.name) ?? 'Unknown';
    return targets.map((target) => ({ ...target, targetValue: Number(target.targetValue), scopeName: nameFor(target.scope, target.scopeId) }));
  }

  async upsert(actor: SessionUser, dto: TargetDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    if (dto.scope === 'STAFF' && !(await this.prisma.user.findUnique({ where: { id: dto.scopeId } }))) throw new NotFoundException('Staff member not found.');
    if (dto.scope === 'TERRITORY' && !(await this.prisma.territory.findUnique({ where: { id: dto.scopeId } }))) throw new NotFoundException('Territory not found.');
    if (dto.scope === 'REGION' && !(await this.prisma.region.findUnique({ where: { id: dto.scopeId } }))) throw new NotFoundException('Region not found.');
    const target = await this.prisma.target.upsert({
      where: { scope_scopeId_metric_period_periodYear_periodIndex: { scope: dto.scope, scopeId: dto.scopeId, metric: dto.metric, period: dto.period, periodYear: dto.periodYear, periodIndex: dto.periodIndex } },
      create: { scope: dto.scope, scopeId: dto.scopeId, metric: dto.metric, period: dto.period, periodYear: dto.periodYear, periodIndex: dto.periodIndex, targetValue: dto.targetValue, createdById: actor.id },
      update: { targetValue: dto.targetValue },
    }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('A target already exists for this scope, metric and period.'); throw error; });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TARGET_SET', entity: 'TARGET', entityId: target.id, details: { scope: dto.scope, scopeId: dto.scopeId, metric: dto.metric, targetValue: dto.targetValue }, ipAddress });
    return { ...target, targetValue: Number(target.targetValue) };
  }

  async remove(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.target.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Target not found.');
    await this.prisma.target.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'TARGET_DELETE', entity: 'TARGET', entityId: id, details: { metric: existing.metric }, ipAddress });
    return { deleted: true };
  }

  private async achievements(userId: string | undefined, start: Date, end: Date) {
    const salespersonFilter = userId ? { salespersonId: userId } : {};
    const activityFilter = userId ? { createdById: userId } : {};
    const clientFilter = userId ? { assignedSalespersonId: userId } : {};

    const [revenue, collection, newActiveSalons, visits, productiveVisits, calls, followUps] = await Promise.all([
      this.prisma.order.aggregate({ where: { ...salespersonFilter, createdAt: { gte: start, lt: end }, status: { in: [...fulfilmentStatuses] } }, _sum: { totalAmount: true } }),
      this.prisma.payment.aggregate({ where: { paymentDate: { gte: start, lt: end }, ...(userId ? { invoice: { order: { salespersonId: userId } } } : {}) }, _sum: { amount: true } }),
      this.prisma.client.count({ where: { ...clientFilter, status: 'ACTIVE', createdAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { ...activityFilter, type: 'VISIT', createdAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { ...activityFilter, type: 'VISIT', status: 'COMPLETED', visitOutcome: { in: [...productiveOutcomes] }, checkOutAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { ...activityFilter, type: 'NOTE', createdAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { ...activityFilter, type: 'FOLLOW_UP', status: 'COMPLETED', completedAt: { gte: start, lt: end } } }),
    ]);

    const values: Record<TargetMetric, number> = {
      REVENUE: Number(revenue._sum.totalAmount ?? 0),
      COLLECTION: Number(collection._sum.amount ?? 0),
      NEW_ACTIVE_SALONS: newActiveSalons,
      VISITS: visits,
      PRODUCTIVE_VISITS: productiveVisits,
      CALLS: calls,
      FOLLOW_UPS: followUps,
    };
    return values;
  }

  async myPerformance(actor: SessionUser, query: { month?: number; year?: number }) {
    this.ensureAccess(actor);
    const now = new Date();
    const month = query.month ?? now.getUTCMonth() + 1;
    const year = query.year ?? now.getUTCFullYear();
    const { start, end } = this.monthRange(month, year);
    const [achieved, targets, productMixRaw] = await Promise.all([
      this.achievements(actor.id, start, end),
      this.prisma.target.findMany({ where: { scope: 'STAFF', scopeId: actor.id, period: 'MONTHLY', periodYear: year, periodIndex: month } }),
      this.prisma.orderItem.groupBy({ by: ['productId'], where: { order: { salespersonId: actor.id, createdAt: { gte: start, lt: end }, status: { in: [...fulfilmentStatuses] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 5 }),
    ]);
    const products = productMixRaw.length ? await this.prisma.product.findMany({ where: { id: { in: productMixRaw.map((row) => row.productId) } }, select: { id: true, name: true } }) : [];
    const productMix = productMixRaw.map((row) => ({ productId: row.productId, name: products.find((p) => p.id === row.productId)?.name ?? 'Unknown product', quantity: row._sum.quantity ?? 0, revenue: Number(row._sum.lineTotal ?? 0) }));
    const metrics = (Object.keys(achieved) as TargetMetric[]).map((metric) => ({ metric, achieved: achieved[metric], target: targets.find((t) => t.metric === metric) ? Number(targets.find((t) => t.metric === metric)!.targetValue) : null }));
    return { period: { month, year }, metrics, productMix };
  }

  async adminOverview(actor: SessionUser, query: { month?: number; year?: number }) {
    this.ensureAdminAccess(actor);
    const now = new Date();
    const month = query.month ?? now.getUTCMonth() + 1;
    const year = query.year ?? now.getUTCFullYear();
    const { start, end } = this.monthRange(month, year);
    const [achieved, productMixRaw, leadsThisPeriod] = await Promise.all([
      this.achievements(undefined, start, end),
      this.prisma.orderItem.groupBy({ by: ['productId'], where: { order: { createdAt: { gte: start, lt: end }, status: { in: [...fulfilmentStatuses] } } }, _sum: { quantity: true, lineTotal: true }, orderBy: { _sum: { quantity: 'desc' } }, take: 8 }),
      this.prisma.lead.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { status: true } }),
    ]);
    const products = productMixRaw.length ? await this.prisma.product.findMany({ where: { id: { in: productMixRaw.map((row) => row.productId) } }, select: { id: true, name: true } }) : [];
    const productMix = productMixRaw.map((row) => ({ productId: row.productId, name: products.find((p) => p.id === row.productId)?.name ?? 'Unknown product', quantity: row._sum.quantity ?? 0, revenue: Number(row._sum.lineTotal ?? 0) }));
    const leadsCreated = leadsThisPeriod.length;
    const leadsConverted = leadsThisPeriod.filter((lead) => lead.status === 'CONVERTED').length;
    return { period: { month, year }, metrics: achieved, conversionRatePercent: leadsCreated ? Math.round((leadsConverted / leadsCreated) * 100) : null, leadsCreated, leadsConverted, productMix };
  }
}
