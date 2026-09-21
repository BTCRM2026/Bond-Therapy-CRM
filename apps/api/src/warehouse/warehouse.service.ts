import { ForbiddenException, Injectable } from '@nestjs/common';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';

const warehouseRoles = new Set(['WAREHOUSE']);
const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureAccess(actor: SessionUser) {
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => warehouseRoles.has(role.key))) throw new ForbiddenException('The warehouse workspace is not available to this account.');
  }

  async dashboard(actor: SessionUser) {
    this.ensureAccess(actor);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [pendingDispatch, lowStockCount, receivedToday, dispatchedToday] = await Promise.all([
      this.prisma.order.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.product.count({ where: { isActive: true, stockOnHand: { lte: LOW_STOCK_THRESHOLD } } }),
      this.prisma.stockMovement.aggregate({ where: { type: 'RECEIVED', createdAt: { gte: startOfToday } }, _sum: { quantityChange: true } }),
      this.prisma.order.count({ where: { status: { in: ['DISPATCHED', 'DELIVERED'] }, updatedAt: { gte: startOfToday } } }),
    ]);

    const lowStockItems = await this.prisma.product.findMany({ where: { isActive: true, stockOnHand: { lte: LOW_STOCK_THRESHOLD } }, orderBy: { stockOnHand: 'asc' }, take: 8, select: { id: true, name: true, sku: true, stockOnHand: true, unit: true } });

    return {
      pendingDispatch,
      lowStockCount,
      receivedToday: receivedToday._sum.quantityChange ?? 0,
      dispatchedToday,
      lowStockItems,
    };
  }
}
