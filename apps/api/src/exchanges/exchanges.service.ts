import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExchangeReason, ExchangeStatus, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateExchangeDto, ListExchangesDto, UpdateExchangeStatusDto } from './dto.js';

const salonRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE', 'ACCOUNTS_BILLING', 'WAREHOUSE', 'DEMO_TEAM']);
const accountsRoles = new Set(['ACCOUNTS_BILLING']);
const warehouseRoles = new Set(['WAREHOUSE']);
const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const photoReasons = new Set<ExchangeReason>([ExchangeReason.DAMAGED_OR_LEAKING, ExchangeReason.QUALITY_COMPLAINT]);
const exchangeInclude = {
  client: { select: { id: true, salonName: true, city: true } },
  order: { select: { id: true, orderNumber: true, deliveredAt: true } },
  invoice: { select: { id: true, invoiceNumber: true, issuedAt: true, totalAmount: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  items: { select: { id: true, orderItemId: true, originalProductId: true, replacementProductId: true, requestedQuantity: true, approvedQuantity: true, receivedQuantity: true, reason: true, batchNumber: true, expiryDate: true, conditionPhotoMime: true, disposition: true, inspectionNotes: true, createdAt: true, updatedAt: true, originalProduct: { select: { id: true, name: true, sku: true } }, replacementProduct: { select: { id: true, name: true, sku: true } }, orderItem: { select: { quantity: true, unitPrice: true } } } },
  history: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ExchangeRequestInclude;

@Injectable()
export class ExchangesService {
  constructor(private readonly prisma: PrismaService) {}

  private hasRole(actor: SessionUser, roles: Set<string>) { return actor.roles.some((role) => roles.has(role.key)); }
  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isSales(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, salesRoles); }
  private isAccounts(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, accountsRoles); }
  private isWarehouse(actor: SessionUser) { return actor.portal === 'STAFF' && this.hasRole(actor, warehouseRoles); }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !this.hasRole(actor, salonRoles)) throw new ForbiddenException('Product exchanges are not available to this account.');
  }

  private clientVisibility(actor: SessionUser): Prisma.ClientWhereInput {
    if (this.isAdmin(actor) || this.isAccounts(actor) || this.isWarehouse(actor)) return {};
    if (actor.roles.some((role) => role.key === 'DEMO_TEAM')) return { OR: [{ assignedTrainerId: actor.id }, { createdById: actor.id }] };
    if (actor.dataScope === 'TEAM') return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }, { assignedSalesperson: { managerId: actor.id } }] };
    return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }] };
  }

  private visibility(actor: SessionUser): Prisma.ExchangeRequestWhereInput {
    return this.isAdmin(actor) || this.isAccounts(actor) || this.isWarehouse(actor) ? {} : { client: this.clientVisibility(actor) };
  }

  private async getVisible(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const exchange = await this.prisma.exchangeRequest.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, include: exchangeInclude });
    if (!exchange) throw new NotFoundException('Exchange request not found or you do not have access to it.');
    return exchange;
  }

  async list(actor: SessionUser, query: ListExchangesDto) {
    this.ensureAccess(actor);
    const where = { AND: [this.visibility(actor), query.clientId ? { clientId: query.clientId } : {}, query.status ? { status: query.status } : {}] } satisfies Prisma.ExchangeRequestWhereInput;
    return this.prisma.exchangeRequest.findMany({ where, include: exchangeInclude, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  detail(actor: SessionUser, id: string) { return this.getVisible(actor, id); }

  async create(actor: SessionUser, clientId: string, dto: CreateExchangeDto, ipAddress?: string) {
    if (!this.isAdmin(actor) && !this.isSales(actor)) throw new ForbiddenException('Only Sales or Super Admin can submit an exchange request.');
    const exchange = await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findFirst({ where: { AND: [{ id: clientId }, this.clientVisibility(actor)] }, select: { id: true } });
      if (!client) throw new NotFoundException('Salon not found or you do not have access to it.');
      const order = await tx.order.findFirst({ where: { id: dto.orderId, clientId, status: { in: ['DELIVERED', 'DISTRIBUTOR_FULFILLED'] } }, include: { invoice: { select: { id: true } }, items: true } });
      if (!order?.invoice) throw new ConflictException('Select a delivered order with a generated invoice.');
      const duplicateIds = dto.items.map((item) => item.orderItemId);
      if (new Set(duplicateIds).size !== duplicateIds.length) throw new ConflictException('Add each delivered product only once.');
      const creates: Prisma.ExchangeItemCreateWithoutExchangeInput[] = [];
      for (const requested of dto.items) {
        const source = order.items.find((item) => item.id === requested.orderItemId);
        if (!source) throw new ConflictException('One of the selected products does not belong to this delivered order.');
        const previous = await tx.exchangeItem.findMany({ where: { orderItemId: source.id, exchange: { status: { not: 'REJECTED' } } }, select: { requestedQuantity: true, approvedQuantity: true } });
        const committed = previous.reduce((sum, item) => sum + (item.approvedQuantity ?? item.requestedQuantity), 0);
        if (requested.quantity + committed > source.quantity) throw new ConflictException(`Exchange quantity exceeds the remaining eligible quantity for this product (${Math.max(0, source.quantity - committed)} available).`);
        if (requested.replacementProductId) {
          const replacement = await tx.product.findFirst({ where: { id: requested.replacementProductId, isActive: true }, select: { id: true } });
          if (!replacement) throw new ConflictException('Select an active replacement product.');
        }
        creates.push({ orderItem: { connect: { id: source.id } }, originalProduct: { connect: { id: source.productId } }, replacementProduct: { connect: { id: requested.replacementProductId || source.productId } }, requestedQuantity: requested.quantity, reason: requested.reason, batchNumber: requested.batchNumber?.trim() || null, expiryDate: requested.expiryDate ? new Date(requested.expiryDate) : null });
      }
      const now = new Date();
      const year = now.getFullYear();
      const counter = await tx.employeeCounter.upsert({ where: { key: `EXC:${year}` }, create: { key: `EXC:${year}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
      const exchangeNumber = `BT-EXC-${year}-${String(counter.nextNumber).padStart(4, '0')}`;
      return tx.exchangeRequest.create({
        data: { exchangeNumber, clientId, orderId: order.id, invoiceId: order.invoice.id, pickupRequired: dto.pickupRequired ?? false, salonRemarks: dto.salonRemarks?.trim() || null, requestedById: actor.id, items: { create: creates }, history: { create: { toStatus: 'SUBMITTED', note: 'Exchange request submitted', actorId: actor.id } } },
        include: exchangeInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'EXCHANGE_SUBMITTED', entity: 'EXCHANGE', entityId: exchange.id, details: { exchangeNumber: exchange.exchangeNumber, clientId, orderId: dto.orderId }, ipAddress });
    return exchange;
  }

  async uploadPhoto(actor: SessionUser, id: string, itemId: string, file: { buffer: Buffer; mimetype: string; size: number }, ipAddress?: string) {
    const exchange = await this.getVisible(actor, id);
    if (!this.isAdmin(actor) && exchange.requestedById !== actor.id) throw new ForbiddenException('Only the requester or Super Admin can add product-condition evidence.');
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(exchange.status)) throw new ConflictException('Evidence can no longer be changed for this exchange.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new ConflictException('Upload a JPG, PNG, or WebP image.');
    if (file.size > 5 * 1024 * 1024) throw new ConflictException('Photo must be 5 MB or smaller.');
    const item = exchange.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException('Exchange item not found.');
    await this.prisma.exchangeItem.update({ where: { id: itemId }, data: { conditionPhoto: file.buffer, conditionPhotoMime: file.mimetype } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'EXCHANGE_PHOTO_UPLOADED', entity: 'EXCHANGE', entityId: id, details: { itemId, mimeType: file.mimetype, size: file.size }, ipAddress });
    return { itemId, conditionPhotoMime: file.mimetype };
  }

  async photo(actor: SessionUser, id: string, itemId: string) {
    await this.getVisible(actor, id);
    const item = await this.prisma.exchangeItem.findFirst({ where: { id: itemId, exchangeId: id }, select: { conditionPhoto: true, conditionPhotoMime: true } });
    if (!item?.conditionPhoto || !item.conditionPhotoMime) throw new NotFoundException('Product-condition photo not found.');
    return { buffer: Buffer.from(item.conditionPhoto), mime: item.conditionPhotoMime };
  }

  async updateStatus(actor: SessionUser, id: string, dto: UpdateExchangeStatusDto, ipAddress?: string) {
    const exchange = await this.getVisible(actor, id);
    const target = dto.status;
    const accounts = this.isAdmin(actor) || this.isAccounts(actor);
    const warehouse = this.isAdmin(actor) || this.isWarehouse(actor);
    const sales = this.isAdmin(actor) || this.isSales(actor);
    const allowed = accounts && exchange.status === 'SUBMITTED' && target === 'UNDER_REVIEW'
      || accounts && exchange.status === 'UNDER_REVIEW' && ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].includes(target)
      || sales && ['APPROVED', 'PARTIALLY_APPROVED'].includes(exchange.status) && target === 'PICKUP_SCHEDULED'
      || warehouse && ['APPROVED', 'PARTIALLY_APPROVED', 'PICKUP_SCHEDULED'].includes(exchange.status) && target === 'RECEIVED'
      || warehouse && exchange.status === 'RECEIVED' && target === 'INSPECTED'
      || accounts && exchange.status === 'INSPECTED' && ['REPLACEMENT_APPROVED', 'CREDIT_NOTE_APPROVED'].includes(target)
      || warehouse && exchange.status === 'REPLACEMENT_APPROVED' && target === 'REPLACEMENT_DISPATCHED'
      || accounts && ['CREDIT_NOTE_APPROVED', 'REPLACEMENT_DISPATCHED'].includes(exchange.status) && target === 'CLOSED';
    if (!allowed) throw new ConflictException(`Cannot move an exchange from ${exchange.status} to ${target}.`);
    if (target === 'REJECTED' && !dto.note?.trim()) throw new ConflictException('Enter the rejection reason.');
    const decisions = new Map((dto.items ?? []).map((item) => [item.itemId, item]));
    const result = await this.prisma.$transaction(async (tx) => {
      if (['APPROVED', 'PARTIALLY_APPROVED'].includes(target)) {
        for (const item of exchange.items) {
          if (photoReasons.has(item.reason) && !item.conditionPhotoMime) throw new ConflictException(`Upload a condition photo for ${item.originalProduct.name} before approval.`);
          const approved = target === 'APPROVED' ? item.requestedQuantity : decisions.get(item.id)?.approvedQuantity;
          if (approved == null || approved < 0 || approved > item.requestedQuantity) throw new ConflictException(`Enter a valid approved quantity for ${item.originalProduct.name}.`);
          await tx.exchangeItem.update({ where: { id: item.id }, data: { approvedQuantity: approved, replacementProductId: decisions.get(item.id)?.replacementProductId || item.replacementProductId } });
        }
        if (target === 'PARTIALLY_APPROVED' && !exchange.items.some((item) => (decisions.get(item.id)?.approvedQuantity ?? 0) > 0)) throw new ConflictException('At least one product quantity must be approved.');
      }
      if (target === 'RECEIVED') {
        for (const item of exchange.items) {
          const approved = item.approvedQuantity ?? item.requestedQuantity;
          const received = decisions.get(item.id)?.receivedQuantity ?? approved;
          if (received < 0 || received > approved) throw new ConflictException(`Received quantity is invalid for ${item.originalProduct.name}.`);
          await tx.exchangeItem.update({ where: { id: item.id }, data: { receivedQuantity: received } });
        }
      }
      if (target === 'INSPECTED') {
        for (const item of exchange.items) {
          const decision = decisions.get(item.id);
          if ((item.receivedQuantity ?? 0) > 0 && !decision?.disposition) throw new ConflictException(`Select a warehouse disposition for ${item.originalProduct.name}.`);
          await tx.exchangeItem.update({ where: { id: item.id }, data: { disposition: decision?.disposition, inspectionNotes: decision?.inspectionNotes?.trim() || null } });
          if (decision?.disposition === 'SALEABLE' && (item.receivedQuantity ?? 0) > 0) {
            await tx.product.update({ where: { id: item.originalProductId }, data: { stockOnHand: { increment: item.receivedQuantity ?? 0 } } });
            await tx.stockMovement.create({ data: { productId: item.originalProductId, type: 'RETURNED', quantityChange: item.receivedQuantity ?? 0, reason: `${exchange.exchangeNumber} - inspected as saleable`, recordedById: actor.id } });
          }
        }
      }
      if (target === 'REPLACEMENT_APPROVED') {
        for (const item of exchange.items) if ((item.approvedQuantity ?? 0) > 0 && !item.replacementProductId) throw new ConflictException(`Select a replacement product for ${item.originalProduct.name}.`);
      }
      if (target === 'CREDIT_NOTE_APPROVED' && (!dto.resolutionReference?.trim() || !dto.creditAmount || dto.creditAmount <= 0)) throw new ConflictException('Enter the approved credit-note reference and amount.');
      if (target === 'REPLACEMENT_DISPATCHED') {
        if (!dto.resolutionReference?.trim()) throw new ConflictException('Enter the dispatch or tracking reference.');
        for (const item of exchange.items) {
          const quantity = item.approvedQuantity ?? 0;
          if (!quantity || !item.replacementProductId) continue;
          const reserved = await tx.product.updateMany({ where: { id: item.replacementProductId, stockOnHand: { gte: quantity } }, data: { stockOnHand: { decrement: quantity } } });
          if (!reserved.count) throw new ConflictException(`${item.replacementProduct?.name ?? 'Replacement product'} does not have enough stock.`);
          await tx.stockMovement.create({ data: { productId: item.replacementProductId, type: 'ADJUSTMENT', quantityChange: -quantity, reason: `${exchange.exchangeNumber} - replacement dispatched`, recordedById: actor.id } });
        }
      }
      const dates: Prisma.ExchangeRequestUncheckedUpdateManyInput = target === 'UNDER_REVIEW' ? { reviewedAt: new Date(), reviewedById: actor.id }
        : ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].includes(target) ? { reviewedAt: new Date(), reviewedById: actor.id }
        : target === 'RECEIVED' ? { receivedAt: new Date(), receivedById: actor.id }
        : target === 'INSPECTED' ? { inspectedAt: new Date() }
        : target === 'REPLACEMENT_DISPATCHED' ? { dispatchedAt: new Date() }
        : target === 'CLOSED' ? { closedAt: new Date() } : {};
      const claimed = await tx.exchangeRequest.updateMany({ where: { id, status: exchange.status, version: dto.version }, data: { status: target, reviewComment: ['APPROVED', 'PARTIALLY_APPROVED'].includes(target) ? dto.note?.trim() || null : exchange.reviewComment, rejectionReason: target === 'REJECTED' ? dto.note?.trim() : exchange.rejectionReason, resolutionReference: dto.resolutionReference?.trim() || exchange.resolutionReference, creditAmount: dto.creditAmount ?? exchange.creditAmount, ...dates, version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('This exchange changed while you were working on it. Refresh and try again.');
      await tx.exchangeStatusHistory.create({ data: { exchangeId: id, fromStatus: exchange.status, toStatus: target, note: dto.note?.trim() || null, actorId: actor.id } });
      return tx.exchangeRequest.findUniqueOrThrow({ where: { id }, include: exchangeInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await recordAudit(this.prisma, { actorId: actor.id, action: `EXCHANGE_${target}`, entity: 'EXCHANGE', entityId: id, details: { from: exchange.status, to: target, exchangeNumber: exchange.exchangeNumber }, ipAddress });
    return result;
  }
}
