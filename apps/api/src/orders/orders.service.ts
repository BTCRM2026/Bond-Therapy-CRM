import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateOrderDto, ListOrdersDto, UpdateOrderDto, UpdateOrderStatusDto } from './dto.js';
import { calculateOrder } from './order-calculation.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const accountsRoles = new Set(['ACCOUNTS_BILLING']);
const warehouseRoles = new Set(['WAREHOUSE']);
const distributorRoles = new Set(['DISTRIBUTOR_STAFF']);
const orderInclude = {
  client: { select: { id: true, salonName: true, billingName: true, city: true, state: true, stateCode: true, gstin: true, fullAddress: true, pincode: true, primaryContact: true, email: true, distributorId: true } },
  salesperson: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true, hsnCode: true, stockOnHand: true } } } },
  invoice: { select: { id: true, invoiceNumber: true, status: true, amountPaid: true, balanceDue: true } },
  deliveryProof: { select: { id: true, arrivalPhotoMime: true, deliveryPhotoMime: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private hasRole(actor: SessionUser, roles: Set<string>) { return actor.roles.some((role) => roles.has(role.key)); }
  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isSales(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, salesRoles); }
  private isAccounts(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, accountsRoles); }
  private isWarehouse(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, warehouseRoles); }
  private isDistributor(actor: SessionUser) { return actor.portal === 'DISTRIBUTOR' && this.hasRole(actor, distributorRoles) && Boolean(actor.distributorId); }

  private ensureAccess(actor: SessionUser) {
    if (!this.isAdmin(actor) && !this.isSales(actor) && !this.isAccounts(actor) && !this.isWarehouse(actor) && !this.isDistributor(actor)) throw new ForbiddenException('Orders are not available to this account.');
  }

  private visibility(actor: SessionUser): Prisma.OrderWhereInput {
    if (this.isAdmin(actor) || this.isAccounts(actor)) return {};
    if (this.isDistributor(actor)) return { client: { distributorId: actor.distributorId }, status: { in: ['FORWARDED_TO_DISTRIBUTOR', 'DISTRIBUTOR_FULFILLED'] } };
    if (this.isWarehouse(actor)) return { status: { in: ['CONFIRMED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'DISPATCHED', 'DELIVERED'] } };
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
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const search = query.search?.trim();
    const where = { AND: [this.visibility(actor), query.status ? { status: query.status } : {}, search ? { OR: [{ orderNumber: { contains: search } }, { client: { salonName: { contains: search } } }] } : {}] } satisfies Prisma.OrderWhereInput;
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
    const activity = await this.prisma.auditLog.findMany({ where: { entity: 'ORDER', entityId: id }, include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } });
    return { ...order, activity };
  }

  private async prepare(actor: SessionUser, dto: CreateOrderDto, allowAccounts = false) {
    const client = await this.prisma.client.findFirst({ where: allowAccounts ? { id: dto.clientId } : { AND: [{ id: dto.clientId }, this.clientVisibility(actor)] } });
    if (!client) throw new NotFoundException('Customer not found or you do not have access to it.');
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    if (productIds.length !== dto.items.length) throw new ConflictException('Each product may appear only once. Update its quantity instead.');
    const [products, settings] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } }),
      this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} }),
    ]);
    if (products.length !== productIds.length) throw new NotFoundException('One or more active products were not found.');
    const discount = dto.discountAmount ?? 0;
    if (this.isSales(actor)) {
      if (!settings.allowSalesDiscount && discount > 0) throw new ForbiddenException('Sales discounts are disabled by the administrator.');
      const subtotal = dto.items.reduce((sum, item) => sum + Number(products.find((product) => product.id === item.productId)!.unitPrice) * item.quantity, 0);
      if (subtotal > 0 && discount / subtotal * 100 > Number(settings.maxSalesDiscountPercent)) throw new ForbiddenException(`Discount exceeds the allowed ${Number(settings.maxSalesDiscountPercent)}% limit.`);
    }
    const interstate = Boolean(settings.stateCode && client.stateCode && settings.stateCode !== client.stateCode);
    return { client, products, settings, calculation: calculateOrder(dto.items, products, discount, Number(settings.defaultGstRate), interstate) };
  }

  async create(actor: SessionUser, dto: CreateOrderDto, ipAddress?: string) {
    if (!this.isSales(actor) && !this.isAdmin(actor)) throw new ForbiddenException('Creating order drafts is restricted to Sales.');
    const prepared = await this.prepare(actor, dto);
    const order = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: 'ORD' }, create: { key: 'ORD', nextNumber: 1001 }, update: { nextNumber: { increment: 1 } } });
      return tx.order.create({ data: { orderNumber: `ORD-${counter.nextNumber}`, clientId: prepared.client.id, salespersonId: actor.id, status: 'DRAFT', ...this.orderData(prepared.calculation, dto.notes), items: { create: prepared.calculation.items } }, include: orderInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ORDER_DRAFT_CREATED', entity: 'ORDER', entityId: order.id, details: { orderNumber: order.orderNumber, status: order.status, totalAmount: order.totalAmount.toString() }, ipAddress });
    return order;
  }

  private orderData(calculation: ReturnType<typeof calculateOrder>, notes?: string) {
    return { subtotal: calculation.subtotal, discountAmount: calculation.discountAmount, taxableAmount: calculation.taxableAmount, taxAmount: calculation.taxAmount, cgstAmount: calculation.cgstAmount, sgstAmount: calculation.sgstAmount, igstAmount: calculation.igstAmount, totalAmount: calculation.totalAmount, notes: notes?.trim() || null };
  }

  async update(actor: SessionUser, id: string, dto: UpdateOrderDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const current = await this.prisma.order.findFirst({ where: { AND: [{ id }, this.visibility(actor)] } });
    if (!current) throw new NotFoundException('Order draft not found.');
    const salesEditable = this.isSales(actor) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(current.status);
    const accountsEditable = (this.isAccounts(actor) || this.isAdmin(actor)) && current.status === 'UNDER_REVIEW';
    if (!salesEditable && !accountsEditable && !this.isAdmin(actor)) throw new ConflictException('This order can no longer be edited.');
    const prepared = await this.prepare(actor, dto, accountsEditable || this.isAdmin(actor));
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({ where: { id, version: dto.version, status: current.status }, data: { clientId: prepared.client.id, ...this.orderData(prepared.calculation, dto.notes), version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('This order was updated by another user. Refresh and try again.');
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({ data: prepared.calculation.items.map((item) => ({ ...item, orderId: id })) });
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'ORDER_DRAFT_UPDATED', entity: 'ORDER', entityId: id, details: { previousVersion: dto.version, newVersion: updated.version, previousTotal: current.totalAmount.toString(), newTotal: updated.totalAmount.toString() }, ipAddress });
    return updated;
  }

  async updateStatus(actor: SessionUser, id: string, dto: UpdateOrderStatusDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const order = await this.prisma.order.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, include: { items: { include: { product: true } }, client: { select: { distributorId: true } } } });
    if (!order) throw new NotFoundException('Order not found.');
    const target = dto.status;
    const isAccounts = this.isAccounts(actor) || this.isAdmin(actor);
    const allowed = (this.isSales(actor) || this.isAdmin(actor)) && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(order.status) && target === 'SUBMITTED'
      || isAccounts && order.status === 'SUBMITTED' && ['UNDER_REVIEW', 'REJECTED', 'RETURNED_FOR_CORRECTION'].includes(target)
      || isAccounts && order.status === 'UNDER_REVIEW' && ['APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION'].includes(target)
      || isAccounts && order.status === 'APPROVED' && target === 'FORWARDED_TO_DISTRIBUTOR' && Boolean(order.client.distributorId)
      || this.isDistributor(actor) && order.status === 'FORWARDED_TO_DISTRIBUTOR' && target === 'DISTRIBUTOR_FULFILLED' && order.client.distributorId === actor.distributorId
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'INVOICE_GENERATED' && target === 'STOCK_RESERVED'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'STOCK_RESERVED' && target === 'PICKING'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'PICKING' && target === 'PACKED'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'PACKED' && target === 'READY_FOR_DISPATCH'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'READY_FOR_DISPATCH' && ['OUT_FOR_DELIVERY', 'DISPATCHED'].includes(target)
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'OUT_FOR_DELIVERY' && target === 'ARRIVED_AT_CUSTOMER'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && ['ARRIVED_AT_CUSTOMER', 'DISPATCHED'].includes(order.status) && target === 'DELIVERED'
      || (this.isWarehouse(actor) || this.isAdmin(actor)) && order.status === 'CONFIRMED' && target === 'DISPATCHED';
    if (!allowed) throw new ConflictException(`Cannot move an order from ${order.status} to ${target}.`);
    if (['REJECTED', 'RETURNED_FOR_CORRECTION'].includes(target) && !dto.comment?.trim()) throw new ConflictException('A reason is required for this action.');

    const updated = await this.prisma.$transaction(async (tx) => {
      if (target === 'STOCK_RESERVED') {
        for (const item of order.items) {
          const reserved = await tx.product.updateMany({ where: { id: item.productId, stockOnHand: { gte: item.quantity } }, data: { stockOnHand: { decrement: item.quantity } } });
          if (!reserved.count) throw new ConflictException(`${item.product.name} no longer has enough stock. Return the draft for correction.`);
        }
      }
      if (target === 'DISTRIBUTOR_FULFILLED') {
        const distributorId = order.client.distributorId!;
        for (const item of order.items) {
          const reserved = await tx.distributorStock.updateMany({ where: { distributorId, productId: item.productId, quantityOnHand: { gte: item.quantity } }, data: { quantityOnHand: { decrement: item.quantity } } });
          if (!reserved.count) throw new ConflictException(`${item.product.name} no longer has enough distributor stock.`);
          await tx.distributorStockMovement.create({ data: { distributorId, productId: item.productId, type: 'SOLD_TO_SALON', quantityChange: -item.quantity, orderId: id, recordedById: actor.id } });
        }
      }
      const proof = await tx.deliveryProof.findUnique({ where: { orderId: id }, select: { arrivalPhotoMime: true, deliveryPhotoMime: true } });
      if (target === 'OUT_FOR_DELIVERY' && (!dto.deliveryPersonName?.trim() || !dto.deliveryPersonMobile?.trim())) throw new ConflictException('Assign the delivery person and mobile number before starting delivery.');
      if (target === 'DISPATCHED' && order.status === 'READY_FOR_DISPATCH' && !dto.trackingNumber?.trim()) throw new ConflictException('Enter the Mark Courier sticker/tracking number before dispatch.');
      if (target === 'ARRIVED_AT_CUSTOMER' && !proof?.arrivalPhotoMime) throw new ConflictException('Upload the customer arrival photo first.');
      if (target === 'DELIVERED' && order.status === 'ARRIVED_AT_CUSTOMER' && !proof?.deliveryPhotoMime) throw new ConflictException('Upload the delivery photo first.');
      const dates: Prisma.OrderUncheckedUpdateManyInput = target === 'SUBMITTED' ? { submittedAt: new Date() }
        : target === 'UNDER_REVIEW' ? { reviewStartedAt: new Date(), reviewedById: actor.id }
        : target === 'RETURNED_FOR_CORRECTION' ? { returnedAt: new Date(), reviewedById: actor.id }
        : target === 'REJECTED' ? { rejectedAt: new Date(), reviewedById: actor.id }
        : target === 'APPROVED' ? { approvedAt: new Date(), reviewedById: actor.id }
        : target === 'FORWARDED_TO_DISTRIBUTOR' ? { forwardedToDistributorAt: new Date() }
        : target === 'DISTRIBUTOR_FULFILLED' ? { distributorFulfilledAt: new Date() }
        : target === 'STOCK_RESERVED' ? { stockReservedAt: new Date() }
        : target === 'PICKING' ? { pickingStartedAt: new Date() }
        : target === 'PACKED' ? { packedAt: new Date() }
        : target === 'READY_FOR_DISPATCH' ? { readyForDispatchAt: new Date() }
        : target === 'OUT_FOR_DELIVERY' ? { deliveryMode: 'VADODARA_LOCAL', deliveryPersonName: dto.deliveryPersonName?.trim(), deliveryPersonMobile: dto.deliveryPersonMobile?.trim(), outForDeliveryAt: new Date() }
        : target === 'ARRIVED_AT_CUSTOMER' ? { arrivedAt: new Date() }
        : target === 'DISPATCHED' ? { deliveryMode: order.status === 'READY_FOR_DISPATCH' ? 'OUTSTATION_COURIER' : order.deliveryMode, courierName: order.status === 'READY_FOR_DISPATCH' ? dto.courierName?.trim() || 'Mark Courier' : order.courierName, trackingNumber: dto.trackingNumber?.trim() || order.trackingNumber, dispatchedAt: new Date() }
        : target === 'DELIVERED' ? { deliveredAt: new Date() } : {};
      const claimed = await tx.order.updateMany({ where: { id, status: order.status, version: dto.version }, data: { status: target, ...(isAccounts ? { reviewComment: dto.comment?.trim() || null } : {}), ...dates, version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('This order changed while you were reviewing it. Refresh and try again.');
      return tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: `ORDER_${target}`, entity: 'ORDER', entityId: id, details: { from: order.status, to: target, previousVersion: dto.version, newVersion: updated.version, comment: dto.comment?.trim() || null }, ipAddress });
    return updated;
  }

  async uploadDeliveryProof(actor: SessionUser, id: string, kind: 'arrival' | 'delivery', file: { buffer: Buffer; mimetype: string; size: number }, ipAddress?: string) {
    if (!this.isWarehouse(actor) && !this.isAdmin(actor)) throw new ForbiddenException('Delivery proof is restricted to the Warehouse team.');
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.deliveryMode !== 'VADODARA_LOCAL') throw new ConflictException('Photos are only required for Vadodara local delivery.');
    if (kind === 'arrival' && order.status !== 'OUT_FOR_DELIVERY') throw new ConflictException('Arrival proof can be added only while the order is out for delivery.');
    if (kind === 'delivery' && order.status !== 'ARRIVED_AT_CUSTOMER') throw new ConflictException('Delivery proof can be added only after arrival is confirmed.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new ConflictException('Upload a JPG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw new ConflictException('Photo must be 5 MB or smaller.');
    const data = kind === 'arrival' ? { arrivalPhoto: file.buffer, arrivalPhotoMime: file.mimetype } : { deliveryPhoto: file.buffer, deliveryPhotoMime: file.mimetype };
    const proof = await this.prisma.deliveryProof.upsert({ where: { orderId: id }, create: { orderId: id, ...data }, update: data, select: { id: true, arrivalPhotoMime: true, deliveryPhotoMime: true } });
    await recordAudit(this.prisma, { actorId: actor.id, action: kind === 'arrival' ? 'ARRIVAL_PHOTO_UPLOADED' : 'DELIVERY_PHOTO_UPLOADED', entity: 'ORDER', entityId: id, details: { mimeType: file.mimetype, size: file.size }, ipAddress });
    return proof;
  }

  async deliveryProof(actor: SessionUser, id: string, kind: 'arrival' | 'delivery') {
    this.ensureAccess(actor);
    const order = await this.prisma.order.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, select: { id: true, deliveryProof: true } });
    if (!order?.deliveryProof) throw new NotFoundException('Delivery proof not found.');
    const buffer = kind === 'arrival' ? order.deliveryProof.arrivalPhoto : order.deliveryProof.deliveryPhoto;
    const mime = kind === 'arrival' ? order.deliveryProof.arrivalPhotoMime : order.deliveryProof.deliveryPhotoMime;
    if (!buffer || !mime) throw new NotFoundException('Delivery proof not found.');
    return { buffer: Buffer.from(buffer), mime };
  }
}
