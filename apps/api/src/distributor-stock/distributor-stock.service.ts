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
    return this.prisma.distributorStock.findMany({
      where: { distributorId },
      include: { product: { select: productSelect } },
      orderBy: { product: { name: 'asc' } },
    });
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
