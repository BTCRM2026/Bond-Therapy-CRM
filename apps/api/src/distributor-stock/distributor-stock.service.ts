import { ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListDistributorStockDto } from './dto.js';

const productSelect = { id: true, name: true, sku: true, unit: true } as const;

@Injectable()
export class DistributorStockService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isDistributor(actor: SessionUser) { return actor.portal === 'DISTRIBUTOR' && Boolean(actor.distributorId); }

  private resolveDistributorId(actor: SessionUser, requested?: string) {
    if (this.isDistributor(actor)) return actor.distributorId!;
    if (this.isAdmin(actor) && requested) return requested;
    throw new ForbiddenException('Select a distributor to view its stock.');
  }

  async list(actor: SessionUser, query: ListDistributorStockDto) {
    const distributorId = this.resolveDistributorId(actor, query.distributorId);
    const [stock, reserved, inbound] = await Promise.all([
      this.prisma.distributorStock.findMany({ where: { distributorId }, include: { product: { select: productSelect } }, orderBy: { product: { name: 'asc' } } }),
      this.prisma.replenishmentItem.findMany({ where: { request: { sourceDistributorId: distributorId, status: { in: ['APPROVED', 'PICKING', 'PACKED'] } } }, select: { productId: true, acceptedQuantity: true, quantity: true } }),
      this.prisma.replenishmentItem.findMany({ where: { request: { distributorId, status: 'DISPATCHED' } }, select: { productId: true, dispatchedQuantity: true, product: { select: productSelect } } }),
    ]);
    const totals = (rows: Array<{ productId: string; quantity: number }>) => rows.reduce((map, row) => map.set(row.productId, (map.get(row.productId) ?? 0) + row.quantity), new Map<string, number>());
    const reservedByProduct = totals(reserved.map((row) => ({ productId: row.productId, quantity: row.acceptedQuantity ?? row.quantity })));
    const inboundByProduct = totals(inbound.map((row) => ({ productId: row.productId, quantity: row.dispatchedQuantity ?? 0 })));
    const rows = stock.map((row) => ({ ...row, reservedQuantity: reservedByProduct.get(row.productId) ?? 0, availableQuantity: Math.max(0, row.quantityOnHand - (reservedByProduct.get(row.productId) ?? 0)), inboundQuantity: inboundByProduct.get(row.productId) ?? 0 }));
    for (const item of inbound) if (!rows.some((row) => row.productId === item.productId)) rows.push({ id: `inbound:${item.productId}`, distributorId, productId: item.productId, quantityOnHand: 0, availableQuantity: 0, reservedQuantity: 0, inboundQuantity: inboundByProduct.get(item.productId) ?? 0, updatedAt: new Date(), product: item.product });
    return rows.sort((a, b) => a.product.name.localeCompare(b.product.name));
  }

  async movements(actor: SessionUser, query: ListDistributorStockDto) {
    const distributorId = this.resolveDistributorId(actor, query.distributorId);
    return this.prisma.distributorStockMovement.findMany({
      where: { distributorId },
      include: { product: { select: productSelect }, recordedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
