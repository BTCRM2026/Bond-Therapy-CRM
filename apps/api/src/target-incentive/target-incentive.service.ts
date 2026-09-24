import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AnnualTargetPlan, TargetIncentiveConfig, TargetIncentiveSlab, TargetPeriod } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PerformanceQueryDto, UpsertPlanDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const fulfilmentStatuses = ['APPROVED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'] as const;
const round2 = (value: number) => Math.round(value * 100) / 100;

type Season = { name: string; weightagePercent: number; startDate: string; endDate: string };
type ConfigWithSlabs = TargetIncentiveConfig & { slabs: TargetIncentiveSlab[] };

@Injectable()
export class TargetIncentiveService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Target & incentive data is not available to this account.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Managing annual targets is restricted to Super Admin.');
  }

  private periodRange(period: TargetPeriod, year: number, index: number, target?: { periodStart: Date | null; periodEnd: Date | null }) {
    if (period === 'SEASONAL') {
      if (!target?.periodStart || !target?.periodEnd) throw new NotFoundException('Season dates not found for this target.');
      return { start: target.periodStart, end: new Date(target.periodEnd.getTime() + 86_400_000) };
    }
    if (period === 'MONTHLY') return { start: new Date(Date.UTC(year, index - 1, 1)), end: new Date(Date.UTC(year, index, 1)) };
    if (period === 'QUARTERLY') return { start: new Date(Date.UTC(year, (index - 1) * 3, 1)), end: new Date(Date.UTC(year, index * 3, 1)) };
    if (period === 'HALF_YEARLY') return { start: new Date(Date.UTC(year, (index - 1) * 6, 1)), end: new Date(Date.UTC(year, index * 6, 1)) };
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)) };
  }

  private async actualSales(userId: string, start: Date, end: Date) {
    const revenue = await this.prisma.order.aggregate({ where: { salespersonId: userId, createdAt: { gte: start, lt: end }, status: { in: [...fulfilmentStatuses] } }, _sum: { totalAmount: true } });
    return Number(revenue._sum.totalAmount ?? 0);
  }

  private computeIncentive(config: ConfigWithSlabs, achievementPercent: number, actualAmount: number, targetValue: number) {
    const minAchievementPercent = Number(config.minAchievementPercent);
    if (achievementPercent < minAchievementPercent) {
      return { eligible: false, incentiveAmount: 0, calculation: { reason: 'BELOW_MIN_ACHIEVEMENT', minAchievementPercent, achievementPercent } };
    }
    const basisAmount = config.calculationBasis === 'TOTAL_ELIGIBLE_SALES' ? actualAmount : config.calculationBasis === 'SALES_ABOVE_TARGET' ? Math.max(0, actualAmount - targetValue) : targetValue;
    if (config.incentiveType === 'PERCENTAGE') {
      const percent = Number(config.percentValue ?? 0);
      return { eligible: true, incentiveAmount: round2((basisAmount * percent) / 100), calculation: { type: 'PERCENTAGE', percent, basisAmount } };
    }
    if (config.incentiveType === 'FIXED') {
      const amount = Number(config.fixedAmount ?? 0);
      return { eligible: true, incentiveAmount: amount, calculation: { type: 'FIXED', amount } };
    }
    const slab = config.slabs.find((s) => achievementPercent >= Number(s.minAchievementPercent) && (s.maxAchievementPercent == null || achievementPercent <= Number(s.maxAchievementPercent)));
    if (!slab) return { eligible: true, incentiveAmount: 0, calculation: { type: 'SLAB', matched: false, achievementPercent } };
    const amount = slab.valueType === 'PERCENTAGE' ? round2((basisAmount * Number(slab.value)) / 100) : Number(slab.value);
    return { eligible: true, incentiveAmount: amount, calculation: { type: 'SLAB', slabId: slab.id, basisAmount } };
  }

  private async generateTargets(tx: Prisma.TransactionClient, plan: AnnualTargetPlan, actorId: string) {
    await tx.target.deleteMany({ where: { annualPlanId: plan.id } });
    const annual = Number(plan.annualTarget);
    const base = { scope: 'STAFF' as const, metric: 'REVENUE' as const, scopeId: plan.staffId, createdById: actorId, annualPlanId: plan.id };
    const rows: Prisma.TargetCreateManyInput[] = [];
    for (let m = 1; m <= 12; m++) rows.push({ ...base, period: 'MONTHLY', periodYear: plan.targetYear, periodIndex: m, targetValue: round2(annual / 12) });
    for (let q = 1; q <= 4; q++) rows.push({ ...base, period: 'QUARTERLY', periodYear: plan.targetYear, periodIndex: q, targetValue: round2(annual / 4) });
    for (let h = 1; h <= 2; h++) rows.push({ ...base, period: 'HALF_YEARLY', periodYear: plan.targetYear, periodIndex: h, targetValue: round2(annual / 2) });
    rows.push({ ...base, period: 'YEARLY', periodYear: plan.targetYear, periodIndex: 1, targetValue: round2(annual) });
    if (plan.distributionType === 'SEASONAL') {
      const seasons = (plan.seasons as unknown as Season[] | null) ?? [];
      seasons.forEach((season, i) => {
        rows.push({ ...base, period: 'SEASONAL', periodYear: plan.targetYear, periodIndex: i + 1, targetValue: round2((annual * season.weightagePercent) / 100), periodStart: new Date(season.startDate), periodEnd: new Date(season.endDate) });
      });
    }
    for (const row of rows) {
      await tx.target.upsert({
        where: { scope_scopeId_metric_period_periodYear_periodIndex: { scope: row.scope, scopeId: row.scopeId, metric: row.metric, period: row.period, periodYear: row.periodYear, periodIndex: row.periodIndex } },
        create: row,
        update: row,
      });
    }
  }

  private serializePlan(plan: AnnualTargetPlan & { incentiveConfig: ConfigWithSlabs | null; staff?: { id: string; name: string } | null }) {
    return {
      id: plan.id,
      staffId: plan.staffId,
      staffName: plan.staff?.name ?? null,
      targetYear: plan.targetYear,
      annualTarget: Number(plan.annualTarget),
      distributionType: plan.distributionType,
      seasons: (plan.seasons as unknown as Season[] | null) ?? null,
      isActive: plan.isActive,
      incentive: plan.incentiveConfig
        ? {
            incentiveType: plan.incentiveConfig.incentiveType,
            calculationBasis: plan.incentiveConfig.calculationBasis,
            percentValue: plan.incentiveConfig.percentValue ? Number(plan.incentiveConfig.percentValue) : null,
            fixedAmount: plan.incentiveConfig.fixedAmount ? Number(plan.incentiveConfig.fixedAmount) : null,
            minAchievementPercent: Number(plan.incentiveConfig.minAchievementPercent),
            slabs: plan.incentiveConfig.slabs.map((s) => ({ id: s.id, minAchievementPercent: Number(s.minAchievementPercent), maxAchievementPercent: s.maxAchievementPercent ? Number(s.maxAchievementPercent) : null, valueType: s.valueType, value: Number(s.value) })),
          }
        : null,
    };
  }

  async listPlans(actor: SessionUser) {
    this.ensureAdminAccess(actor);
    const staff = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } },
      include: {
        roles: { include: { role: true } },
        annualTargetPlansAsStaff: { where: { isActive: true }, include: { incentiveConfig: { include: { slabs: true } } }, orderBy: { targetYear: 'desc' }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    return Promise.all(staff.map(async (member) => {
      const plan = member.annualTargetPlansAsStaff[0] ?? null;
      let currentMonthAchievement: { targetValue: number; actual: number; achievementPercent: number } | null = null;
      if (plan) {
        const targetRow = await this.prisma.target.findFirst({ where: { annualPlanId: plan.id, period: 'MONTHLY', periodYear: year, periodIndex: month } });
        if (targetRow) {
          const { start, end } = this.periodRange('MONTHLY', year, month);
          const actual = await this.actualSales(member.id, start, end);
          const targetValue = Number(targetRow.targetValue);
          currentMonthAchievement = { targetValue, actual, achievementPercent: targetValue > 0 ? round2((actual / targetValue) * 100) : 0 };
        }
      }
      return { staffId: member.id, name: member.name, roleKey: member.roles[0]?.role.key ?? null, plan: plan ? this.serializePlan(plan) : null, currentMonthAchievement };
    }));
  }

  async upsertPlan(actor: SessionUser, dto: UpsertPlanDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const staff = await this.prisma.user.findUnique({ where: { id: dto.staffId }, include: { roles: { include: { role: true } } } });
    if (!staff) throw new NotFoundException('Staff member not found.');
    if (!staff.roles.some((r) => salesRoles.has(r.role.key))) throw new BadRequestException('Annual targets can only be assigned to sales staff.');

    if (dto.distributionType === 'SEASONAL') {
      if (!dto.seasons?.length) throw new BadRequestException('Add at least one season for seasonal distribution.');
      const total = dto.seasons.reduce((sum, s) => sum + s.weightagePercent, 0);
      if (Math.abs(total - 100) > 0.01) throw new BadRequestException(`Season weightages must total 100%. Currently ${total.toFixed(2)}%.`);
      const parsed = dto.seasons.map((s) => { const start = new Date(s.startDate); const end = new Date(s.endDate); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException(`Invalid date range for season "${s.name}".`); if (end < start) throw new BadRequestException(`Season "${s.name}" end date must be on or after its start date.`); return { name: s.name, start, end }; });
      const sorted = [...parsed].sort((a, b) => a.start.getTime() - b.start.getTime());
      for (let i = 1; i < sorted.length; i++) if (sorted[i].start <= sorted[i - 1].end) throw new BadRequestException(`Season "${sorted[i].name}" overlaps with "${sorted[i - 1].name}".`);
    }

    if (dto.incentiveType === 'PERCENTAGE' && dto.percentValue == null) throw new BadRequestException('Set a percentage value for a percentage-based incentive.');
    if (dto.incentiveType === 'FIXED' && dto.fixedAmount == null) throw new BadRequestException('Set a fixed amount for a fixed incentive.');
    if (dto.incentiveType === 'SLAB') {
      if (!dto.slabs?.length) throw new BadRequestException('Add at least one slab for a slab-based incentive.');
      const sorted = [...dto.slabs].sort((a, b) => a.minAchievementPercent - b.minAchievementPercent);
      for (let i = 1; i < sorted.length; i++) { const prev = sorted[i - 1]; if (prev.maxAchievementPercent == null || sorted[i].minAchievementPercent < prev.maxAchievementPercent) throw new BadRequestException('Slab achievement ranges must not overlap.'); }
    }

    const wasExisting = await this.prisma.annualTargetPlan.findUnique({ where: { staffId_targetYear: { staffId: dto.staffId, targetYear: dto.targetYear } } });
    const plan = await this.prisma.$transaction(async (tx) => {
      const seasonsJson = dto.distributionType === 'SEASONAL' ? (dto.seasons as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
      const savedPlan = wasExisting
        ? await tx.annualTargetPlan.update({ where: { id: wasExisting.id }, data: { annualTarget: dto.annualTarget, distributionType: dto.distributionType, seasons: seasonsJson, isActive: true } })
        : await tx.annualTargetPlan.create({ data: { staffId: dto.staffId, targetYear: dto.targetYear, annualTarget: dto.annualTarget, distributionType: dto.distributionType, seasons: seasonsJson, createdById: actor.id } });

      await tx.targetIncentiveConfig.upsert({
        where: { planId: savedPlan.id },
        create: { planId: savedPlan.id, incentiveType: dto.incentiveType, calculationBasis: dto.calculationBasis, percentValue: dto.percentValue ?? null, fixedAmount: dto.fixedAmount ?? null, minAchievementPercent: dto.minAchievementPercent },
        update: { incentiveType: dto.incentiveType, calculationBasis: dto.calculationBasis, percentValue: dto.percentValue ?? null, fixedAmount: dto.fixedAmount ?? null, minAchievementPercent: dto.minAchievementPercent },
      });
      const config = await tx.targetIncentiveConfig.findUniqueOrThrow({ where: { planId: savedPlan.id } });
      await tx.targetIncentiveSlab.deleteMany({ where: { configId: config.id } });
      if (dto.incentiveType === 'SLAB' && dto.slabs?.length) {
        await tx.targetIncentiveSlab.createMany({ data: dto.slabs.map((s) => ({ configId: config.id, minAchievementPercent: s.minAchievementPercent, maxAchievementPercent: s.maxAchievementPercent ?? null, valueType: s.valueType, value: s.value })) });
      }

      await this.generateTargets(tx, savedPlan, actor.id);
      return savedPlan;
    });

    await recordAudit(this.prisma, { actorId: actor.id, action: wasExisting ? 'ANNUAL_TARGET_PLAN_UPDATE' : 'ANNUAL_TARGET_PLAN_CREATE', entity: 'ANNUAL_TARGET_PLAN', entityId: plan.id, details: { staffId: dto.staffId, targetYear: dto.targetYear, annualTarget: dto.annualTarget }, ipAddress });
    return this.getPlanDetail(actor, plan.id);
  }

  async getPlanDetail(actor: SessionUser, id: string) {
    this.ensureAdminAccess(actor);
    const plan = await this.prisma.annualTargetPlan.findUnique({ where: { id }, include: { incentiveConfig: { include: { slabs: true } }, staff: { select: { id: true, name: true } } } });
    if (!plan) throw new NotFoundException('Annual target plan not found.');
    return this.serializePlan(plan);
  }

  async deactivatePlan(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const plan = await this.prisma.annualTargetPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Annual target plan not found.');
    await this.prisma.annualTargetPlan.update({ where: { id }, data: { isActive: false } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ANNUAL_TARGET_PLAN_DEACTIVATE', entity: 'ANNUAL_TARGET_PLAN', entityId: id, details: { staffId: plan.staffId }, ipAddress });
    return { deactivated: true };
  }

  async myPerformance(actor: SessionUser, query: PerformanceQueryDto) {
    this.ensureAccess(actor);
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const plan = await this.prisma.annualTargetPlan.findFirst({ where: { staffId: actor.id, targetYear: year, isActive: true }, include: { incentiveConfig: { include: { slabs: true } } } });
    if (!plan) return { hasPlan: false as const, period: { period: query.period, year } };

    let index = query.index;
    if (index == null) {
      if (query.period === 'MONTHLY') index = now.getUTCMonth() + 1;
      else if (query.period === 'QUARTERLY') index = Math.floor(now.getUTCMonth() / 3) + 1;
      else if (query.period === 'HALF_YEARLY') index = now.getUTCMonth() < 6 ? 1 : 2;
      else index = 1;
    }

    const targetRow = await this.prisma.target.findFirst({ where: { annualPlanId: plan.id, period: query.period, periodYear: year, periodIndex: index } });
    if (!targetRow) return { hasPlan: true as const, available: false as const, period: { period: query.period, year, index } };

    const { start, end } = this.periodRange(query.period, year, index, targetRow);
    const actual = await this.actualSales(actor.id, start, end);
    const targetValue = Number(targetRow.targetValue);
    const achievementPercent = targetValue > 0 ? round2((actual / targetValue) * 100) : 0;
    const remaining = Math.max(0, targetValue - actual);
    const incentive = plan.incentiveConfig ? this.computeIncentive(plan.incentiveConfig, achievementPercent, actual, targetValue) : null;

    return {
      hasPlan: true as const,
      available: true as const,
      plan: { targetYear: plan.targetYear, annualTarget: Number(plan.annualTarget), distributionType: plan.distributionType, seasons: (plan.seasons as unknown as Season[] | null) ?? null },
      period: { period: query.period, year, index, start, end },
      target: targetValue,
      actual,
      remaining,
      achievementPercent,
      incentive,
    };
  }
}
