import { ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAccess(actor: SessionUser) {
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Sales workspace is not available to this account.');
  }

  private monthRange(month: number, year: number) {
    return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
  }

  async dashboard(actor: SessionUser) {
    this.ensureAccess(actor);
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    const { start, end } = this.monthRange(month, year);

    const [target, ownOrders, openLeads, overdueFollowUps] = await Promise.all([
      this.prisma.salesTarget.findUnique({ where: { userId_periodYear_periodMonth: { userId: actor.id, periodYear: year, periodMonth: month } } }),
      this.prisma.order.aggregate({ where: { salespersonId: actor.id, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.lead.count({ where: { assignedToId: actor.id, status: { in: ['NEW', 'CONTACTED', 'QUALIFIED'] } } }),
      this.prisma.clientActivity.count({ where: { createdById: actor.id, status: 'OPEN', scheduledAt: { lt: now } } }),
    ]);

    let leaderboard: Array<{ id: string; name: string; achieved: number; target: number | null; orderCount: number }> | null = null;
    if (actor.dataScope === 'TEAM') {
      const team = await this.prisma.user.findMany({ where: { OR: [{ id: actor.id }, { managerId: actor.id }] }, select: { id: true, name: true } });
      const teamIds = team.map((member) => member.id);
      const [orderSums, targets] = await Promise.all([
        this.prisma.order.groupBy({ by: ['salespersonId'], where: { salespersonId: { in: teamIds }, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true }, _count: true }),
        this.prisma.salesTarget.findMany({ where: { userId: { in: teamIds }, periodYear: year, periodMonth: month } }),
      ]);
      leaderboard = team
        .map((member) => {
          const sum = orderSums.find((row) => row.salespersonId === member.id);
          const memberTarget = targets.find((row) => row.userId === member.id);
          return { id: member.id, name: member.name, achieved: Number(sum?._sum.totalAmount ?? 0), target: memberTarget ? Number(memberTarget.targetAmount) : null, orderCount: sum?._count ?? 0 };
        })
        .sort((a, b) => b.achieved - a.achieved);
    }

    return {
      period: { month, year },
      target: target ? Number(target.targetAmount) : null,
      achieved: Number(ownOrders._sum.totalAmount ?? 0),
      orderCount: ownOrders._count,
      openLeads,
      overdueFollowUps,
      leaderboard,
    };
  }

  async performance(actor: SessionUser, monthParam?: number, yearParam?: number) {
    this.ensureAccess(actor);
    const now = new Date();
    const month = monthParam ?? now.getUTCMonth() + 1;
    const year = yearParam ?? now.getUTCFullYear();
    const { start, end } = this.monthRange(month, year);

    const [target, revenue, newActiveClients, productiveVisits, callsAndVisits, leadsThisPeriod, productMixRaw] = await Promise.all([
      this.prisma.salesTarget.findUnique({ where: { userId_periodYear_periodMonth: { userId: actor.id, periodYear: year, periodMonth: month } } }),
      this.prisma.order.aggregate({ where: { salespersonId: actor.id, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, _sum: { totalAmount: true }, _count: true }),
      this.prisma.client.count({ where: { assignedSalespersonId: actor.id, status: 'ACTIVE', createdAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { createdById: actor.id, type: 'VISIT', status: 'COMPLETED', createdAt: { gte: start, lt: end } } }),
      this.prisma.clientActivity.count({ where: { createdById: actor.id, createdAt: { gte: start, lt: end } } }),
      this.prisma.lead.findMany({ where: { assignedToId: actor.id, createdAt: { gte: start, lt: end } }, select: { status: true } }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { salespersonId: actor.id, createdAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
    ]);

    const leadsCreated = leadsThisPeriod.length;
    const leadsConverted = leadsThisPeriod.filter((lead) => lead.status === 'CONVERTED').length;
    const conversionRatePercent = leadsCreated > 0 ? Math.round((leadsConverted / leadsCreated) * 100) : null;

    const products = productMixRaw.length ? await this.prisma.product.findMany({ where: { id: { in: productMixRaw.map((row) => row.productId) } }, select: { id: true, name: true } }) : [];
    const productMix = productMixRaw.map((row) => ({
      productId: row.productId,
      name: products.find((product) => product.id === row.productId)?.name ?? 'Unknown product',
      quantity: row._sum.quantity ?? 0,
      revenue: Number(row._sum.lineTotal ?? 0),
    }));

    return {
      period: { month, year },
      target: target ? Number(target.targetAmount) : null,
      revenue: Number(revenue._sum.totalAmount ?? 0),
      orderCount: revenue._count,
      newActiveClients,
      productiveVisits,
      callsAndVisits,
      leadsCreated,
      leadsConverted,
      conversionRatePercent,
      productMix,
    };
  }
}
