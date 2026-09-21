import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto, ListOrdersDto, UpdateOrderStatusDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const warehouseRoles = new Set(['WAREHOUSE']);
const orderInclude = {
  client: { select: { id: true, salonName: true, city: true, primaryContact: true } },
  salesperson: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
} satisfies Prisma.OrderInclude;
const ALLOWED_TRANSITIONS: Record<string, string[]> = { CONFIRMED: ['DISPATCHED'], DISPATCHED: ['DELIVERED'] };

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private isWarehouse(actor: SessionUser) {
    return actor.portal === 'STAFF' && actor.roles.some((role) => warehouseRoles.has(role.key));
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor) || this.isWarehouse(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Orders are not available to this account.');
  }

  private ensureSalesAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Booking orders is restricted to the Sales team.');
  }

  private ensureWarehouseAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (!this.isWarehouse(actor)) throw new ForbiddenException('Updating dispatch status is restricted to the Warehouse team.');
  }

  private visibility(actor: SessionUser): Prisma.OrderWhereInput {
    if (this.isAdmin(actor) || this.isWarehouse(actor)) return {};
    if (actor.dataScope === 'TEAM') return { OR: [{ salespersonId: actor.id }, { salesperson: { managerId: actor.id } }] };
    return { salespersonId: actor.id };
  }

  private clientVisibility(actor: SessionUser): Prisma.ClientWhereInput {
    if (this.isAdmin(actor)) return {};
    if (actor.dataScope === 'TEAM') return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }, { assignedSalesperson: { managerId: actor.id } }] };
    return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }] };
  }

  async list(actor: SessionUser, query: ListOrdersDto) {
    this.ensureAccess(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const where = { AND: [this.visibility(actor), query.status ? { status: query.status } : {}] } satisfies Prisma.OrderWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.order.count({ where }),
    ]);
    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  async detail(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const order = await this.prisma.order.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found or you do not have access to it.');
    return order;
  }

  async create(actor: SessionUser, dto: CreateOrderDto, ipAddress?: string) {
    this.ensureSalesAccess(actor);
    const client = await this.prisma.client.findFirst({ where: { AND: [{ id: dto.clientId }, this.clientVisibility(actor)] }, select: { id: true } });
    if (!client) throw new NotFoundException('Salon not found or you do not have access to it.');

    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } });
    const shortfalls: Array<{ productId: string; name: string; available: number; requested: number }> = [];
    for (const item of dto.items) {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) throw new NotFoundException('One or more products were not found.');
      if (product.stockOnHand < item.quantity) shortfalls.push({ productId: product.id, name: product.name, available: product.stockOnHand, requested: item.quantity });
    }
    if (shortfalls.length) throw new ConflictException({ message: 'Not enough stock for one or more products. Adjust quantities before confirming.', shortfalls });

    const order = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: 'ORD' }, create: { key: 'ORD', nextNumber: 1001 }, update: { nextNumber: { increment: 1 } } });
      const orderNumber = `ORD-${counter.nextNumber}`;
      let subtotal = 0;
      const itemsData = dto.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId)!;
        const unitPrice = Number(product.unitPrice);
        const lineTotal = unitPrice * item.quantity;
        subtotal += lineTotal;
        return { productId: product.id, quantity: item.quantity, unitPrice, lineTotal };
      });
      const discountAmount = dto.discountAmount ?? 0;
      const totalAmount = Math.max(0, subtotal - discountAmount);
      const created = await tx.order.create({
        data: {
          orderNumber,
          clientId: client.id,
          salespersonId: actor.id,
          status: 'CONFIRMED',
          subtotal,
          discountAmount,
          totalAmount,
          notes: dto.notes?.trim() || null,
          items: { create: itemsData },
        },
        include: orderInclude,
      });
      for (const item of dto.items) await tx.product.update({ where: { id: item.productId }, data: { stockOnHand: { decrement: item.quantity } } });
      return created;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ORDER_CREATE', entity: 'ORDER', entityId: order.id, details: { orderNumber: order.orderNumber, totalAmount: order.totalAmount.toString() }, ipAddress });
    return order;
  }

  async updateStatus(actor: SessionUser, id: string, dto: UpdateOrderStatusDto, ipAddress?: string) {
    this.ensureWarehouseAccess(actor);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) throw new ConflictException(`Cannot move an order from ${order.status} to ${dto.status}.`);
    const updated = await this.prisma.order.update({ where: { id }, data: { status: dto.status }, include: orderInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ORDER_STATUS_UPDATE', entity: 'ORDER', entityId: id, details: { from: order.status, to: dto.status }, ipAddress });
    return updated;
  }
}
