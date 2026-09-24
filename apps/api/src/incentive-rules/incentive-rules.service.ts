import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { IncentiveCalcStatus, IncentiveRuleVersion } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IncentiveRuleDto, IncentiveRuleVersionDto, RejectCalculationDto, RunCalculationDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const OPEN_STATUSES = new Set(['CALCULATED', 'PENDING_APPROVAL']);
const salespersonWithRoles = { salesperson: { include: { roles: { include: { role: true } } } } } satisfies Prisma.OrderInclude;

type Slab = { minAmount: number; maxAmount?: number; percent?: number; fixedAmount?: number };

@Injectable()
export class IncentiveRulesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private isManager(actor: SessionUser) {
    return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'SALES_MANAGER');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Incentives are not available to this account.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Managing incentive rules is restricted to Super Admin.');
  }

  private ensureApproverAccess(actor: SessionUser) {
    if (this.isAdmin(actor) || this.isManager(actor)) return;
    throw new ForbiddenException('Approving incentives is restricted to Sales Managers and Super Admin.');
  }

  private monthRange(month: number, year: number) {
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  async listRules(actor: SessionUser) {
    this.ensureAdminAccess(actor);
    const rules = await this.prisma.incentiveRule.findMany({ include: { versions: { orderBy: { versionNumber: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    return rules.map((rule) => ({ ...rule, versions: rule.versions.map((v) => this.serializeVersion(v)) }));
  }

  private serializeVersion(version: IncentiveRuleVersion) {
    return { ...version, percent: version.percent ? Number(version.percent) : null, fixedAmount: version.fixedAmount ? Number(version.fixedAmount) : null, minThreshold: version.minThreshold ? Number(version.minThreshold) : null, maxThreshold: version.maxThreshold ? Number(version.maxThreshold) : null };
  }

  async createRule(actor: SessionUser, dto: IncentiveRuleDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const rule = await this.prisma.incentiveRule.create({ data: { name: dto.name.trim(), description: dto.description?.trim() || null, createdById: actor.id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_RULE_CREATE', entity: 'INCENTIVE_RULE', entityId: rule.id, details: { name: rule.name }, ipAddress });
    return { ...rule, versions: [] };
  }

  async createVersion(actor: SessionUser, ruleId: string, dto: IncentiveRuleVersionDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const rule = await this.prisma.incentiveRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException('Incentive rule not found.');
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) throw new BadRequestException('Invalid effective-from date.');
    const effectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
    if (effectiveUntil && Number.isNaN(effectiveUntil.getTime())) throw new BadRequestException('Invalid effective-until date.');
    if (effectiveUntil && effectiveUntil <= effectiveFrom) throw new BadRequestException('Effective-until must be after effective-from.');
    const status = dto.status ?? 'ACTIVE';

    if (status === 'ACTIVE') {
      const activeVersions = await this.prisma.incentiveRuleVersion.findMany({ where: { ruleId, status: 'ACTIVE' } });
      const farFuture = new Date('9999-12-31');
      const newUntil = effectiveUntil ?? farFuture;
      const overlaps = activeVersions.some((v) => effectiveFrom < (v.effectiveUntil ?? farFuture) && v.effectiveFrom < newUntil);
      if (overlaps) throw new ConflictException('This version overlaps with an existing active version of the rule. Set an effective-until date on the previous version first.');
    }

    const maxVersion = await this.prisma.incentiveRuleVersion.aggregate({ where: { ruleId }, _max: { versionNumber: true } });
    const version = await this.prisma.incentiveRuleVersion.create({
      data: {
        ruleId, versionNumber: (maxVersion._max.versionNumber ?? 0) + 1,
        sourceType: dto.sourceType, calcType: dto.calcType,
        percent: dto.percent ?? null, fixedAmount: dto.fixedAmount ?? null,
        slabs: (dto.slabs as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull, roleEligibility: dto.roleEligibility ?? Prisma.JsonNull, productCategoryEligibility: dto.productCategoryEligibility ?? Prisma.JsonNull,
        minThreshold: dto.minThreshold ?? null, maxThreshold: dto.maxThreshold ?? null,
        effectiveFrom, effectiveUntil, requiresApproval: dto.requiresApproval ?? true, status,
      },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_RULE_VERSION_CREATE', entity: 'INCENTIVE_RULE_VERSION', entityId: version.id, details: { ruleId, versionNumber: version.versionNumber }, ipAddress });
    return this.serializeVersion(version);
  }

  private calcAmount(version: IncentiveRuleVersion, eligibleAmount: number) {
    if (version.calcType === 'PERCENT') {
      const percent = Number(version.percent ?? 0);
      return { incentiveAmount: Math.round((eligibleAmount * percent) / 100), calculation: { type: 'PERCENT', percent, eligibleAmount } };
    }
    if (version.calcType === 'FIXED') {
      const amount = Number(version.fixedAmount ?? 0);
      return { incentiveAmount: amount, calculation: { type: 'FIXED', fixedAmount: amount } };
    }
    const slabs = (version.slabs as unknown as Slab[] | null) ?? [];
    const slab = slabs.find((s) => eligibleAmount >= s.minAmount && (s.maxAmount == null || eligibleAmount <= s.maxAmount));
    if (!slab) return { incentiveAmount: 0, calculation: { type: 'SLAB', matched: false, eligibleAmount } };
    const amount = slab.percent != null ? Math.round((eligibleAmount * slab.percent) / 100) : Number(slab.fixedAmount ?? 0);
    return { incentiveAmount: amount, calculation: { type: 'SLAB', slab, eligibleAmount } };
  }

  async runCalculation(actor: SessionUser, ruleVersionId: string, dto: RunCalculationDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const version = await this.prisma.incentiveRuleVersion.findUnique({ where: { id: ruleVersionId }, include: { rule: true } });
    if (!version) throw new NotFoundException('Incentive rule version not found.');
    if (version.status !== 'ACTIVE') throw new BadRequestException('Only active rule versions can be run.');

    const { start, end } = this.monthRange(dto.periodMonth, dto.periodYear);
    const rangeStart = version.effectiveFrom > start ? version.effectiveFrom : start;
    const rangeEnd = version.effectiveUntil && version.effectiveUntil < end ? version.effectiveUntil : end;
    if (rangeStart >= rangeEnd) throw new BadRequestException("This period is outside the rule version's effective range.");

    const roleEligibility = version.roleEligibility as unknown as string[] | null;
    const categoryEligibility = version.productCategoryEligibility as unknown as string[] | null;
    const minThreshold = version.minThreshold ? Number(version.minThreshold) : null;
    const maxThreshold = version.maxThreshold ? Number(version.maxThreshold) : null;
    const roleAllowed = (roleKeys: string[]) => !roleEligibility?.length || roleEligibility.some((key) => roleKeys.includes(key));
    const withinThreshold = (amount: number) => (minThreshold == null || amount >= minThreshold) && (maxThreshold == null || amount <= maxThreshold);

    type Txn = { userId: string; sourceId: string; sourceReference: string; sourceDate: Date; eligibleAmount: number };
    const transactions: Txn[] = [];

    if (version.sourceType === 'INVOICE') {
      const invoices = await this.prisma.invoice.findMany({ where: { issuedAt: { gte: rangeStart, lt: rangeEnd } }, include: { order: { include: salespersonWithRoles }, items: true } });
      const productIds = [...new Set(invoices.flatMap((inv) => inv.items.map((item) => item.productId).filter((id): id is string => Boolean(id))))];
      const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, category: true } }) : [];
      for (const invoice of invoices) {
        const roleKeys = invoice.order.salesperson.roles.map((r) => r.role.key);
        if (!roleAllowed(roleKeys)) continue;
        let amount = Number(invoice.totalAmount);
        if (categoryEligibility?.length) amount = invoice.items.filter((item) => item.productId && categoryEligibility.includes(products.find((p) => p.id === item.productId)?.category ?? '')).reduce((sum, item) => sum + Number(item.lineTotal), 0);
        if (amount <= 0 || !withinThreshold(amount)) continue;
        transactions.push({ userId: invoice.order.salespersonId, sourceId: invoice.id, sourceReference: invoice.invoiceNumber, sourceDate: invoice.issuedAt, eligibleAmount: amount });
      }
    } else if (version.sourceType === 'PAYMENT') {
      const payments = await this.prisma.payment.findMany({ where: { paymentDate: { gte: rangeStart, lt: rangeEnd } }, include: { invoice: { include: { order: { include: salespersonWithRoles } } } } });
      for (const payment of payments) {
        const roleKeys = payment.invoice.order.salesperson.roles.map((r) => r.role.key);
        if (!roleAllowed(roleKeys)) continue;
        const amount = Number(payment.amount);
        if (!withinThreshold(amount)) continue;
        transactions.push({ userId: payment.invoice.order.salespersonId, sourceId: payment.id, sourceReference: payment.invoice.invoiceNumber, sourceDate: payment.paymentDate, eligibleAmount: amount });
      }
    } else {
      const orders = await this.prisma.order.findMany({ where: { status: 'DELIVERED', deliveredAt: { gte: rangeStart, lt: rangeEnd } }, include: salespersonWithRoles });
      for (const order of orders) {
        const roleKeys = order.salesperson.roles.map((r) => r.role.key);
        if (!roleAllowed(roleKeys)) continue;
        const amount = Number(order.totalAmount);
        if (!withinThreshold(amount)) continue;
        transactions.push({ userId: order.salespersonId, sourceId: order.id, sourceReference: order.orderNumber, sourceDate: order.deliveredAt!, eligibleAmount: amount });
      }
    }

    let created = 0; let updated = 0; let skipped = 0;
    for (const txn of transactions) {
      const { incentiveAmount, calculation } = this.calcAmount(version, txn.eligibleAmount);
      if (incentiveAmount <= 0) continue;
      const existing = await this.prisma.incentiveCalculation.findUnique({ where: { ruleVersionId_sourceType_sourceId: { ruleVersionId: version.id, sourceType: version.sourceType, sourceId: txn.sourceId } } });
      if (existing) {
        if (!OPEN_STATUSES.has(existing.status)) { skipped++; continue; }
        await this.prisma.incentiveCalculation.update({ where: { id: existing.id }, data: { eligibleAmount: txn.eligibleAmount, calculation, incentiveAmount } });
        updated++;
      } else {
        await this.prisma.incentiveCalculation.create({ data: { ruleVersionId: version.id, userId: txn.userId, sourceType: version.sourceType, sourceId: txn.sourceId, sourceReference: txn.sourceReference, sourceDate: txn.sourceDate, eligibleAmount: txn.eligibleAmount, calculation, incentiveAmount, status: version.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED' } });
        created++;
      }
    }
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_CALC_RUN', entity: 'INCENTIVE_RULE_VERSION', entityId: version.id, details: { period: `${dto.periodYear}-${dto.periodMonth}`, created, updated, skipped }, ipAddress });
    return { created, updated, skipped, matched: transactions.length };
  }

  async listCalculations(actor: SessionUser, query: { status?: string }) {
    this.ensureAccess(actor);
    const where: Prisma.IncentiveCalculationWhereInput = {};
    if (query.status) where.status = query.status as IncentiveCalcStatus;
    if (!this.isAdmin(actor)) {
      if (this.isManager(actor)) where.user = { OR: [{ id: actor.id }, { managerId: actor.id }] };
      else where.userId = actor.id;
    }
    const rows = await this.prisma.incentiveCalculation.findMany({
      where,
      include: { user: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } }, ruleVersion: { include: { rule: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({ ...row, eligibleAmount: Number(row.eligibleAmount), incentiveAmount: Number(row.incentiveAmount), ruleName: row.ruleVersion.rule.name, ruleVersionNumber: row.ruleVersion.versionNumber }));
  }

  async approve(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureApproverAccess(actor);
    const calc = await this.prisma.incentiveCalculation.findUnique({ where: { id } });
    if (!calc) throw new NotFoundException('Incentive calculation not found.');
    if (calc.userId === actor.id) throw new ForbiddenException('You cannot approve your own incentive.');
    if (!OPEN_STATUSES.has(calc.status)) throw new BadRequestException('Only pending calculations can be approved.');
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: calc.userId, managerId: actor.id } });
      if (!member) throw new ForbiddenException('You can only approve incentives for your own team.');
    }
    const updated = await this.prisma.incentiveCalculation.update({ where: { id }, data: { status: 'APPROVED', approvedById: actor.id, approvedAt: new Date(), rejectedReason: null } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_CALC_APPROVE', entity: 'INCENTIVE_CALCULATION', entityId: id, details: { userId: calc.userId }, ipAddress });
    return { ...updated, eligibleAmount: Number(updated.eligibleAmount), incentiveAmount: Number(updated.incentiveAmount) };
  }

  async reject(actor: SessionUser, id: string, dto: RejectCalculationDto, ipAddress?: string) {
    this.ensureApproverAccess(actor);
    const calc = await this.prisma.incentiveCalculation.findUnique({ where: { id } });
    if (!calc) throw new NotFoundException('Incentive calculation not found.');
    if (calc.userId === actor.id) throw new ForbiddenException('You cannot reject your own incentive.');
    if (!OPEN_STATUSES.has(calc.status)) throw new BadRequestException('Only pending calculations can be rejected.');
    if (!this.isAdmin(actor)) {
      const member = await this.prisma.user.findFirst({ where: { id: calc.userId, managerId: actor.id } });
      if (!member) throw new ForbiddenException('You can only reject incentives for your own team.');
    }
    const updated = await this.prisma.incentiveCalculation.update({ where: { id }, data: { status: 'REJECTED', rejectedReason: dto.reason?.trim() || null, approvedById: null, approvedAt: null } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_CALC_REJECT', entity: 'INCENTIVE_CALCULATION', entityId: id, details: { userId: calc.userId, reason: dto.reason }, ipAddress });
    return { ...updated, eligibleAmount: Number(updated.eligibleAmount), incentiveAmount: Number(updated.incentiveAmount) };
  }

  async markPaid(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const calc = await this.prisma.incentiveCalculation.findUnique({ where: { id } });
    if (!calc) throw new NotFoundException('Incentive calculation not found.');
    if (calc.status !== 'APPROVED') throw new BadRequestException('Only approved incentives can be marked as paid.');
    const updated = await this.prisma.incentiveCalculation.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INCENTIVE_CALC_PAID', entity: 'INCENTIVE_CALCULATION', entityId: id, details: { userId: calc.userId }, ipAddress });
    return { ...updated, eligibleAmount: Number(updated.eligibleAmount), incentiveAmount: Number(updated.incentiveAmount) };
  }
}
