import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReplenishmentDto, ListReplenishableProductsDto, ListReplenishmentDto, ReviewReplenishmentDto } from './dto.js';

const requestInclude = {
  distributor: { select: { id: true, businessName: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
} satisfies Prisma.ReplenishmentRequestInclude;

@Injectable()
export class ReplenishmentService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isDistributor(actor: SessionUser) { return actor.portal === 'DISTRIBUTOR' && Boolean(actor.distributorId); }

  private ensureAccess(actor: SessionUser) {
    if (!this.isAdmin(actor) && !this.isDistributor(actor)) throw new ForbiddenException('Replenishment requests are not available to this account.');
  }

  private visibility(actor: SessionUser, distributorId?: string): Prisma.ReplenishmentRequestWhereInput {
    if (this.isDistributor(actor)) return { distributorId: actor.distributorId! };
    return distributorId ? { distributorId } : {};
  }

  async listReplenishableProducts(actor: SessionUser, query: ListReplenishableProductsDto) {
    this.ensureAccess(actor);
    const search = query.search?.trim();
    return this.prisma.product.findMany({
      where: { isActive: true, ...(search ? { name: { contains: search } } : {}) },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
      take: 40,
    });
  }

  async list(actor: SessionUser, query: ListReplenishmentDto) {
    this.ensureAccess(actor);
    const where = { AND: [this.visibility(actor, query.distributorId), query.status ? { status: query.status } : {}] } satisfies Prisma.ReplenishmentRequestWhereInput;
    return this.prisma.replenishmentRequest.findMany({ where, include: requestInclude, orderBy: { createdAt: 'desc' } });
  }

  async create(actor: SessionUser, dto: CreateReplenishmentDto, ipAddress?: string) {
    if (!this.isDistributor(actor)) throw new ForbiddenException('Only a distributor can request replenishment.');
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    if (productIds.length !== dto.items.length) throw new ConflictException('Each product may appear only once. Update its quantity instead.');
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    if (products.length !== productIds.length) throw new NotFoundException('One or more active products were not found.');
    const request = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: 'REPL' }, create: { key: 'REPL', nextNumber: 1001 }, update: { nextNumber: { increment: 1 } } });
      return tx.replenishmentRequest.create({
        data: {
          requestNumber: `REPL-${counter.nextNumber}`,
          distributorId: actor.distributorId!,
          requestedById: actor.id,
          notes: dto.notes?.trim() || null,
          items: { create: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
        },
        include: requestInclude,
      });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_REQUESTED', entity: 'REPLENISHMENT_REQUEST', entityId: request.id, details: { requestNumber: request.requestNumber, itemCount: dto.items.length }, ipAddress });
    return request;
  }

  async approve(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only the administrator can approve replenishment requests.');
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    if (request.status !== 'REQUESTED') throw new ConflictException(`Cannot approve a request that is ${request.status}.`);
    const updated = await this.prisma.replenishmentRequest.update({ where: { id }, data: { status: 'APPROVED', reviewedById: actor.id }, include: requestInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_APPROVED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber }, ipAddress });
    return updated;
  }

  async reject(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only the administrator can reject replenishment requests.');
    if (!dto.comment?.trim()) throw new ConflictException('A reason is required to reject a request.');
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    if (!['REQUESTED', 'APPROVED'].includes(request.status)) throw new ConflictException(`Cannot reject a request that is ${request.status}.`);
    const updated = await this.prisma.replenishmentRequest.update({ where: { id }, data: { status: 'REJECTED', reviewedById: actor.id }, include: requestInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_REJECTED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber, comment: dto.comment.trim() }, ipAddress });
    return updated;
  }

  async fulfill(actor: SessionUser, id: string, ipAddress?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only the administrator can fulfill replenishment requests.');
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    if (request.status !== 'APPROVED') throw new ConflictException('Only an approved request can be fulfilled.');
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of request.items) {
        const reserved = await tx.product.updateMany({ where: { id: item.productId, stockOnHand: { gte: item.quantity } }, data: { stockOnHand: { decrement: item.quantity } } });
        if (!reserved.count) throw new ConflictException(`${item.product.name} no longer has enough central stock.`);
        await tx.stockMovement.create({ data: { productId: item.productId, type: 'ADJUSTMENT', quantityChange: -item.quantity, reason: `Replenishment ${request.requestNumber}`, recordedById: actor.id } });
        await tx.distributorStock.upsert({
          where: { distributorId_productId: { distributorId: request.distributorId, productId: item.productId } },
          create: { distributorId: request.distributorId, productId: item.productId, quantityOnHand: item.quantity },
          update: { quantityOnHand: { increment: item.quantity } },
        });
        await tx.distributorStockMovement.create({ data: { distributorId: request.distributorId, productId: item.productId, type: 'RECEIVED_FROM_HQ', quantityChange: item.quantity, replenishmentRequestId: id, recordedById: actor.id } });
      }
      return tx.replenishmentRequest.update({ where: { id }, data: { status: 'FULFILLED', fulfilledAt: new Date() }, include: requestInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_FULFILLED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber }, ipAddress });
    return updated;
  }
}
