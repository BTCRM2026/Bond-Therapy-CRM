import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListProductsDto, ProductDto, SetProductActiveDto, StockMovementDto } from './dto.js';

const warehouseRoles = new Set(['WAREHOUSE']);
const movementInclude = {
  product: { select: { id: true, name: true, sku: true } },
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.StockMovementInclude;

const titleCase = (value: string) => value.trim().toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
const internalSku = () => `BT-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF') throw new ForbiddenException('Products are not available to this account.');
  }

  private ensureWarehouseAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => warehouseRoles.has(role.key))) throw new ForbiddenException('Stock management is restricted to the Warehouse team.');
  }

  private ensureAdminAccess(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Managing the product catalogue is restricted to Super Admin.');
  }

  async list(actor: SessionUser, query: ListProductsDto) {
    this.ensureAccess(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 100));
    const search = query.search?.trim();
    const filters: Prisma.ProductWhereInput[] = this.isAdmin(actor) ? [] : [{ isActive: true }];
    if (search) filters.push({ OR: [{ name: { contains: search } }, { variant: { contains: search } }] });
    if (query.category) filters.push({ category: query.category });
    const where = { AND: filters } satisfies Prisma.ProductWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.product.count({ where }),
    ]);
    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  async create(actor: SessionUser, dto: ProductDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const product = await this.prisma.product.create({
      data: { sku: internalSku(), name: titleCase(dto.name), category: dto.category, variant: dto.variant?.trim() || null, unit: dto.unit?.trim() || 'pcs', unitPrice: dto.unitPrice, stockOnHand: dto.stockOnHand ?? 0 },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'PRODUCT_CREATE', entity: 'PRODUCT', entityId: product.id, details: { name: product.name, category: product.category }, ipAddress });
    return product;
  }

  async update(actor: SessionUser, id: string, dto: ProductDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found.');
    const product = await this.prisma.product.update({
      where: { id },
      data: { name: titleCase(dto.name), category: dto.category, variant: dto.variant?.trim() || null, unit: dto.unit?.trim() || 'pcs', unitPrice: dto.unitPrice },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'PRODUCT_UPDATE', entity: 'PRODUCT', entityId: id, details: { changes: dto }, ipAddress });
    return product;
  }

  async remove(actor: SessionUser, id: string, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.product.findUnique({ where: { id }, include: { _count: { select: { orderItems: true } } } });
    if (!existing) throw new NotFoundException('Product not found.');
    if (existing._count.orderItems > 0) throw new ConflictException('This product is used in an order and cannot be deleted. Deactivate it instead.');
    await this.prisma.product.delete({ where: { id } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'PRODUCT_DELETE', entity: 'PRODUCT', entityId: id, details: { name: existing.name }, ipAddress });
    return { deleted: true };
  }

  async setActive(actor: SessionUser, id: string, dto: SetProductActiveDto, ipAddress?: string) {
    this.ensureAdminAccess(actor);
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Product not found.');
    const product = await this.prisma.product.update({ where: { id }, data: { isActive: dto.isActive } });
    await recordAudit(this.prisma, { actorId: actor.id, action: dto.isActive ? 'PRODUCT_ACTIVATE' : 'PRODUCT_DEACTIVATE', entity: 'PRODUCT', entityId: id, details: { sku: product.sku }, ipAddress });
    return product;
  }

  async recordMovement(actor: SessionUser, productId: string, dto: StockMovementDto, ipAddress?: string) {
    this.ensureWarehouseAccess(actor);
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found.');
    if ((dto.type === 'RECEIVED' || dto.type === 'RETURNED') && dto.quantityChange <= 0) throw new ForbiddenException('Received or returned stock must be a positive quantity.');
    if (dto.type === 'DAMAGED' && dto.quantityChange >= 0) throw new ForbiddenException('Damaged stock must be recorded as a negative quantity.');
    const nextStock = Math.max(0, product.stockOnHand + dto.quantityChange);
    const [, movement] = await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: productId }, data: { stockOnHand: nextStock } }),
      this.prisma.stockMovement.create({ data: { productId, type: dto.type, quantityChange: dto.quantityChange, reason: dto.reason?.trim() || null, recordedById: actor.id }, include: movementInclude }),
    ]);
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STOCK_MOVEMENT_RECORD', entity: 'PRODUCT', entityId: productId, details: { type: dto.type, quantityChange: dto.quantityChange, newStock: nextStock }, ipAddress });
    return movement;
  }

  async listMovements(actor: SessionUser, productId?: string) {
    this.ensureWarehouseAccess(actor);
    return this.prisma.stockMovement.findMany({ where: productId ? { productId } : undefined, include: movementInclude, orderBy: { createdAt: 'desc' }, take: 50 });
  }
}
