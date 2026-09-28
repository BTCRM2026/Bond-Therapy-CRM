import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import PDFDocument from 'pdfkit';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateReplenishmentDto, ListReplenishableProductsDto, ListReplenishmentDto, PartnerReplenishmentActionDto, ReviewReplenishmentDto } from './dto.js';

const requestInclude = {
  distributor: { select: { id: true, businessName: true } },
  sourceDistributor: { select: { id: true, businessName: true, partnerType: true } },
  requestedBy: { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, name: true, sku: true, unit: true } } } },
} satisfies Prisma.ReplenishmentRequestInclude;

const financialYear = (date = new Date()) => { const start = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1; return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`; };

@Injectable()
export class ReplenishmentService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isCentralWarehouse(actor: SessionUser) { return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'WAREHOUSE'); }
  private isDistributor(actor: SessionUser) { return actor.portal === 'DISTRIBUTOR' && Boolean(actor.distributorId); }
  private isDistributorAccounts(actor: SessionUser) { return this.isDistributor(actor) && actor.roles.some((role) => ['DISTRIBUTOR_OWNER', 'DISTRIBUTOR_ACCOUNTS'].includes(role.key)); }
  private isDistributorWarehouse(actor: SessionUser) { return this.isDistributor(actor) && actor.roles.some((role) => ['DISTRIBUTOR_OWNER', 'DISTRIBUTOR_WAREHOUSE'].includes(role.key)); }
  private isSourcePartner(actor: SessionUser, sourceDistributorId: string | null) { return this.isDistributorAccounts(actor) && Boolean(sourceDistributorId) && actor.distributorId === sourceDistributorId; }

  private ensureAccess(actor: SessionUser) {
    if (!this.isAdmin(actor) && !this.isCentralWarehouse(actor) && !this.isDistributor(actor)) throw new ForbiddenException('Replenishment requests are not available to this account.');
  }

  private visibility(actor: SessionUser, distributorId?: string): Prisma.ReplenishmentRequestWhereInput {
    if (this.isDistributor(actor)) return { OR: [{ distributorId: actor.distributorId! }, { sourceDistributorId: actor.distributorId! }] };
    if (this.isCentralWarehouse(actor)) return { sourceDistributorId: null };
    return distributorId ? { distributorId } : {};
  }

  async listReplenishableProducts(actor: SessionUser, query: ListReplenishableProductsDto) {
    this.ensureAccess(actor);
    const search = query.search?.trim();
    const partner = actor.distributorId ? await this.prisma.distributor.findUnique({ where: { id: actor.distributorId }, select: { parentId: true } }) : null;
    return this.prisma.product.findMany({
      where: { isActive: true, ...(partner?.parentId ? { distributorStock: { some: { distributorId: partner.parentId, quantityOnHand: { gt: 0 } } } } : { stockOnHand: { gt: 0 } }), ...(search ? { name: { contains: search } } : {}) },
      select: { id: true, name: true, sku: true, unit: true },
      orderBy: { name: 'asc' },
      take: 40,
    });
  }

  async list(actor: SessionUser, query: ListReplenishmentDto) {
    this.ensureAccess(actor);
    const where = { AND: [this.visibility(actor, query.distributorId), query.status ? { status: query.status } : {}] } satisfies Prisma.ReplenishmentRequestWhereInput;
    return this.prisma.replenishmentRequest.findMany({ where, include: requestInclude, omit: { invoiceFile: true }, orderBy: { createdAt: 'desc' } });
  }

  async create(actor: SessionUser, dto: CreateReplenishmentDto, ipAddress?: string) {
    if (!this.isDistributorAccounts(actor)) throw new ForbiddenException('Only a distributor Owner or Accounts login can request replenishment.');
    const productIds = [...new Set(dto.items.map((item) => item.productId))];
    if (productIds.length !== dto.items.length) throw new ConflictException('Each product may appear only once. Update its quantity instead.');
    const [products, destination] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds }, isActive: true } }),
      this.prisma.distributor.findUnique({ where: { id: actor.distributorId! }, select: { id: true, parentId: true, partnerType: true } }),
    ]);
    if (products.length !== productIds.length) throw new NotFoundException('One or more active products were not found.');
    if (!destination) throw new NotFoundException('Distribution partner not found.');
    if (destination.partnerType === 'DISTRIBUTOR' && !destination.parentId) throw new ConflictException('Ask the administrator to assign your Super Stockist before requesting replenishment.');
    const request = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: 'REPL' }, create: { key: 'REPL', nextNumber: 1001 }, update: { nextNumber: { increment: 1 } } });
      return tx.replenishmentRequest.create({
        data: {
          requestNumber: `REPL-${counter.nextNumber}`,
          distributorId: actor.distributorId!,
          sourceDistributorId: destination.parentId,
          requestedById: actor.id,
          confirmationToken: randomBytes(24).toString('hex'),
          notes: dto.notes?.trim() || null,
          items: { create: dto.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
        },
        include: requestInclude,
        omit: { invoiceFile: true },
      });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_REQUESTED', entity: 'REPLENISHMENT_REQUEST', entityId: request.id, details: { requestNumber: request.requestNumber, itemCount: dto.items.length }, ipAddress });
    return request;
  }

  async approve(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    if (!(request.sourceDistributorId ? this.isSourcePartner(actor, request.sourceDistributorId) : this.isAdmin(actor))) throw new ForbiddenException('Only the supplying partner can accept this request.');
    if (request.status !== 'REQUESTED') throw new ConflictException(`Cannot approve a request that is ${request.status}.`);
    const decisions = new Map(dto.items?.map((item) => [item.itemId, item.quantity]) ?? []);
    for (const item of request.items) {
      const accepted = decisions.has(item.id) ? decisions.get(item.id)! : item.quantity;
      if (accepted < 0 || accepted > item.quantity) throw new ConflictException(`Accepted quantity for ${item.product.name} must be between 0 and ${item.quantity}.`);
      const reserved = await this.reservedQuantity(request.sourceDistributorId, item.productId);
      const available = request.sourceDistributorId
        ? (await this.prisma.distributorStock.findUnique({ where: { distributorId_productId: { distributorId: request.sourceDistributorId, productId: item.productId } }, select: { quantityOnHand: true } }))?.quantityOnHand ?? 0
        : item.product.stockOnHand;
      if (accepted > available - reserved) throw new ConflictException(`${item.product.name} has only ${Math.max(0, available - reserved)} available after existing reservations.`);
    }
    if (!request.items.some((item) => (decisions.has(item.id) ? decisions.get(item.id)! : item.quantity) > 0)) throw new ConflictException('Accept at least one product quantity.');
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of request.items) await tx.replenishmentItem.update({ where: { id: item.id }, data: { acceptedQuantity: decisions.has(item.id) ? decisions.get(item.id)! : item.quantity } });
      return tx.replenishmentRequest.update({ where: { id }, data: { status: 'APPROVED', reviewedById: actor.id }, include: requestInclude, omit: { invoiceFile: true } });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_APPROVED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber }, ipAddress });
    return updated;
  }

  async reject(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    if (!dto.comment?.trim()) throw new ConflictException('A reason is required to reject a request.');
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    if (!(request.sourceDistributorId ? this.isSourcePartner(actor, request.sourceDistributorId) : this.isAdmin(actor))) throw new ForbiddenException('Only the supplying partner can reject this request.');
    if (!['REQUESTED', 'APPROVED'].includes(request.status)) throw new ConflictException(`Cannot reject a request that is ${request.status}.`);
    const updated = await this.prisma.replenishmentRequest.update({ where: { id }, data: { status: 'REJECTED', reviewedById: actor.id }, include: requestInclude, omit: { invoiceFile: true } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_REJECTED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber, comment: dto.comment.trim() }, ipAddress });
    return updated;
  }

  async fulfill(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id }, include: { items: { include: { product: true } } } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    const central = !request.sourceDistributorId;
    if (!(central ? this.isAdmin(actor) || this.isCentralWarehouse(actor) : this.isDistributorWarehouse(actor) && actor.distributorId === request.sourceDistributorId)) throw new ForbiddenException('Only the supplying warehouse can dispatch this request.');
    if (!['APPROVED', 'PICKING', 'PACKED'].includes(request.status)) throw new ConflictException('Only an accepted request can be dispatched.');
    if (!central && !dto.invoiceReference?.trim()) throw new ConflictException('Enter the Tally/Marg invoice number before dispatch.');
    if (!central && !request.invoiceFile) throw new ConflictException('Upload the Tally/Marg invoice before dispatch.');
    if (!central) { const duplicate = await this.prisma.replenishmentRequest.findFirst({ where: { id: { not: id }, sourceDistributorId: request.sourceDistributorId, invoiceFinancialYear: financialYear(), invoiceReference: dto.invoiceReference!.trim() }, select: { requestNumber: true } }); if (duplicate) throw new ConflictException(`This invoice number is already linked to ${duplicate.requestNumber} in the current financial year.`); }
    const dispatchDecisions = new Map(dto.items?.map((item) => [item.itemId, item.quantity]) ?? []);
    for (const item of request.items) { const quantity = dispatchDecisions.has(item.id) ? dispatchDecisions.get(item.id)! : item.acceptedQuantity ?? item.quantity; if (quantity < 0 || quantity > (item.acceptedQuantity ?? item.quantity)) throw new ConflictException(`Dispatch quantity for ${item.product.name} is invalid.`); }
    if (!request.items.some((item) => (dispatchDecisions.has(item.id) ? dispatchDecisions.get(item.id)! : item.acceptedQuantity ?? item.quantity) > 0)) throw new ConflictException('Dispatch at least one product quantity.');
    const updated = await this.prisma.$transaction(async (tx) => {
      let invoiceReference = dto.invoiceReference?.trim() || null;
      const invoiceFinancialYear = financialYear();
      if (central && !invoiceReference) {
        const counter = await tx.employeeCounter.upsert({ where: { key: `REPL-INV:${invoiceFinancialYear}` }, create: { key: `REPL-INV:${invoiceFinancialYear}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
        invoiceReference = `BT/REP/${invoiceFinancialYear}/${String(counter.nextNumber).padStart(5, '0')}`;
      }
      for (const item of request.items) {
        const quantity = dispatchDecisions.has(item.id) ? dispatchDecisions.get(item.id)! : item.acceptedQuantity ?? item.quantity;
        if (!quantity) continue;
        if (central) {
          const reserved = await tx.product.updateMany({ where: { id: item.productId, stockOnHand: { gte: quantity } }, data: { stockOnHand: { decrement: quantity } } });
          if (!reserved.count) throw new ConflictException(`${item.product.name} no longer has enough central stock.`);
          await tx.stockMovement.create({ data: { productId: item.productId, type: 'ADJUSTMENT', quantityChange: -quantity, reason: `Replenishment ${request.requestNumber}`, recordedById: actor.id } });
        } else {
          const reserved = await tx.distributorStock.updateMany({ where: { distributorId: request.sourceDistributorId!, productId: item.productId, quantityOnHand: { gte: quantity } }, data: { quantityOnHand: { decrement: quantity } } });
          if (!reserved.count) throw new ConflictException(`${item.product.name} no longer has enough Super Stockist stock.`);
          await tx.distributorStockMovement.create({ data: { distributorId: request.sourceDistributorId!, productId: item.productId, type: 'SENT_TO_PARTNER', quantityChange: -quantity, replenishmentRequestId: id, reason: `Supplied to ${request.distributorId}`, recordedById: actor.id } });
        }
        await tx.replenishmentItem.update({ where: { id: item.id }, data: { dispatchedQuantity: quantity } });
      }
      return tx.replenishmentRequest.update({ where: { id }, data: { status: 'DISPATCHED', invoiceReference, invoiceFinancialYear, invoiceDate: new Date(), dispatchedAt: new Date() }, include: requestInclude, omit: { invoiceFile: true } });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_DISPATCHED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber, invoiceReference: updated.invoiceReference }, ipAddress });
    return updated;
  }

  async receive(actor: SessionUser, id: string, dto: ReviewReplenishmentDto, ipAddress?: string) {
    if (!this.isDistributorAccounts(actor) && !this.isDistributorWarehouse(actor)) throw new ForbiddenException('Only the receiving team can confirm receipt.');
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id }, include: { items: true } });
    if (!request || request.distributorId !== actor.distributorId) throw new NotFoundException('Replenishment request not found.');
    if (request.status !== 'DISPATCHED') throw new ConflictException('Only a dispatched request can be received.');
    const updated = await this.prisma.$transaction(async (tx) => {
      const received = new Map(dto.items?.map((item) => [item.itemId, item]) ?? []);
      let hasVariance = false;
      for (const item of request.items) {
        const dispatched = item.dispatchedQuantity ?? item.acceptedQuantity ?? item.quantity;
        const receivedQuantity = received.get(item.id)?.quantity ?? dispatched;
        const damagedQuantity = received.get(item.id)?.damagedQuantity ?? 0;
        if (receivedQuantity + damagedQuantity > dispatched) throw new ConflictException('Received and damaged quantities cannot exceed dispatched quantity.');
        hasVariance ||= receivedQuantity + damagedQuantity !== dispatched || damagedQuantity > 0;
        if (receivedQuantity) {
          await tx.distributorStock.upsert({ where: { distributorId_productId: { distributorId: request.distributorId, productId: item.productId } }, create: { distributorId: request.distributorId, productId: item.productId, quantityOnHand: receivedQuantity }, update: { quantityOnHand: { increment: receivedQuantity } } });
          await tx.distributorStockMovement.create({ data: { distributorId: request.distributorId, productId: item.productId, type: request.sourceDistributorId ? 'RECEIVED_FROM_PARTNER' : 'RECEIVED_FROM_HQ', quantityChange: receivedQuantity, replenishmentRequestId: id, recordedById: actor.id } });
        }
        if (damagedQuantity) await tx.distributorStockMovement.create({ data: { distributorId: request.distributorId, productId: item.productId, type: 'DAMAGED', quantityChange: 0, replenishmentRequestId: id, reason: `${damagedQuantity} damaged in transit`, recordedById: actor.id } });
        await tx.replenishmentItem.update({ where: { id: item.id }, data: { receivedQuantity, damagedQuantity } });
      }
      return tx.replenishmentRequest.update({ where: { id }, data: { status: hasVariance ? 'PARTIALLY_RECEIVED' : 'RECEIVED', receivedAt: new Date(), fulfilledAt: new Date() }, include: requestInclude, omit: { invoiceFile: true } });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_RECEIVED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber }, ipAddress });
    return updated;
  }

  private async reservedQuantity(sourceDistributorId: string | null, productId: string) {
    const rows = await this.prisma.replenishmentItem.findMany({ where: { productId, request: { sourceDistributorId, status: { in: ['APPROVED', 'PICKING', 'PACKED'] } } }, select: { acceptedQuantity: true, quantity: true } });
    return rows.reduce((sum, row) => sum + (row.acceptedQuantity ?? row.quantity), 0);
  }

  async warehouseStep(actor: SessionUser, id: string, target: 'PICKING' | 'PACKED', ipAddress?: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    const allowed = request.sourceDistributorId ? this.isDistributorWarehouse(actor) && actor.distributorId === request.sourceDistributorId : this.isAdmin(actor) || this.isCentralWarehouse(actor);
    if (!allowed) throw new ForbiddenException('Only the supplying warehouse can prepare this request.');
    const expected = target === 'PICKING' ? 'APPROVED' : 'PICKING';
    if (request.status !== expected) throw new ConflictException(`Request must be ${expected.toLowerCase()} first.`);
    const updated = await this.prisma.replenishmentRequest.update({ where: { id }, data: { status: target }, include: requestInclude, omit: { invoiceFile: true } });
    await recordAudit(this.prisma, { actorId: actor.id, action: `REPLENISHMENT_${target}`, entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { requestNumber: updated.requestNumber }, ipAddress });
    return updated;
  }

  async uploadInvoice(actor: SessionUser, id: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }, ipAddress?: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Replenishment request not found.');
    const allowed = request.sourceDistributorId ? actor.distributorId === request.sourceDistributorId && (this.isDistributorAccounts(actor) || this.isDistributorWarehouse(actor)) : this.isAdmin(actor) || this.isCentralWarehouse(actor);
    if (!allowed) throw new ForbiddenException('Only the supplying partner can attach this invoice.');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new ConflictException('Upload a PDF, JPG, PNG, or WebP invoice.');
    if (file.size > 5 * 1024 * 1024) throw new ConflictException('Invoice attachment must be 5 MB or smaller.');
    await this.prisma.replenishmentRequest.update({ where: { id }, data: { invoiceFile: file.buffer, invoiceFileName: file.originalname, invoiceMime: file.mimetype } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_INVOICE_UPLOADED', entity: 'REPLENISHMENT_REQUEST', entityId: id, details: { fileName: file.originalname }, ipAddress });
    return { uploaded: true };
  }

  async invoiceAttachment(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const request = await this.prisma.replenishmentRequest.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, select: { invoiceFile: true, invoiceMime: true, invoiceFileName: true } });
    if (!request?.invoiceFile || !request.invoiceMime) throw new NotFoundException('Invoice attachment not found.');
    return { buffer: Buffer.from(request.invoiceFile), mime: request.invoiceMime, name: request.invoiceFileName ?? 'invoice' };
  }

  async centralInvoicePdf(actor: SessionUser, id: string) {
    if (!this.isAdmin(actor) && !this.isCentralWarehouse(actor) && !this.isDistributor(actor)) throw new ForbiddenException('Invoice is not available to this account.');
    const request = await this.prisma.replenishmentRequest.findFirst({ where: { AND: [{ id, sourceDistributorId: null }, this.visibility(actor)] }, include: { distributor: true, items: { include: { product: true } } } });
    if (!request?.invoiceReference) throw new NotFoundException('Mother Depot invoice has not been generated yet.');
    const doc = new PDFDocument({ size: 'A4', margin: 48 }); const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#202326').text('BOND THERAPY PROFESSIONAL');
    doc.font('Helvetica').fontSize(9).fillColor('#697076').text('Mother Depot · Stock Transfer Invoice'); doc.moveDown(1.4);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#202326').text(`Invoice: ${request.invoiceReference}`); doc.font('Helvetica').fontSize(9).text(`Date: ${new Intl.DateTimeFormat('en-IN').format(request.invoiceDate ?? new Date())}`); doc.text(`Ship to: ${request.distributor.businessName}`); doc.moveDown();
    const left = 48; const widths = [250, 70, 90, 90]; let y = doc.y;
    for (const [index, label] of ['Product', 'Qty', 'Rate', 'Amount'].entries()) { doc.rect(left + widths.slice(0, index).reduce((a, b) => a + b, 0), y, widths[index], 24).fillAndStroke('#ECEEEF', '#C9CDD0'); doc.fillColor('#202326').font('Helvetica-Bold').fontSize(9).text(label, left + widths.slice(0, index).reduce((a, b) => a + b, 0) + 7, y + 8, { width: widths[index] - 14, align: index ? 'right' : 'left' }); }
    y += 24; let total = 0;
    for (const item of request.items.filter((entry) => (entry.dispatchedQuantity ?? entry.acceptedQuantity ?? entry.quantity) > 0)) { const qty = item.dispatchedQuantity ?? item.acceptedQuantity ?? item.quantity; const rate = Number(item.product.unitPrice); const amount = qty * rate; total += amount; const values = [item.product.name, String(qty), rate.toLocaleString('en-IN', { minimumFractionDigits: 2 }), amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })]; for (const [index, value] of values.entries()) { const x = left + widths.slice(0, index).reduce((a, b) => a + b, 0); doc.rect(x, y, widths[index], 24).stroke('#C9CDD0'); doc.fillColor('#34393D').font('Helvetica').fontSize(9).text(value, x + 7, y + 8, { width: widths[index] - 14, align: index ? 'right' : 'left' }); } y += 24; }
    doc.moveDown(); doc.y = y + 10; doc.font('Helvetica-Bold').fontSize(11).text(`Total: INR ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, { align: 'right' }); doc.moveDown(3); doc.font('Helvetica').fontSize(8).fillColor('#697076').text(`CRM reference: ${request.requestNumber} · System generated by Bond Therapy CRM`, { align: 'center' }); doc.end();
    await new Promise<void>((resolve) => doc.on('end', resolve)); return { buffer: Buffer.concat(chunks), name: `${request.invoiceReference.replaceAll('/', '-')}.pdf` };
  }

  async bulkMatchInvoices(actor: SessionUser, file: { buffer: Buffer; mimetype: string; size: number }, ipAddress?: string) {
    if (!this.isDistributorAccounts(actor)) throw new ForbiddenException('Only the supplying Owner or Accounts login can import invoices.');
    if (file.size > 2 * 1024 * 1024) throw new ConflictException('CSV file must be 2 MB or smaller.');
    const lines = file.buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean); const results: Array<{ reference: string; invoice: string; matched: boolean; message?: string }> = [];
    for (const line of lines.slice(1)) {
      const [reference = '', invoice = ''] = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
      if (!reference || !invoice) continue;
      try {
        const request = await this.prisma.replenishmentRequest.findFirst({ where: { requestNumber: reference, sourceDistributorId: actor.distributorId, status: { in: ['APPROVED', 'PICKING', 'PACKED'] } } });
        if (!request) { results.push({ reference, invoice, matched: false, message: 'Eligible request not found' }); continue; }
        await this.prisma.replenishmentRequest.update({ where: { id: request.id }, data: { invoiceReference: invoice, invoiceFinancialYear: financialYear(), invoiceDate: new Date() } }); results.push({ reference, invoice, matched: true });
      } catch { results.push({ reference, invoice, matched: false, message: 'Invoice number already used' }); }
    }
    await recordAudit(this.prisma, { actorId: actor.id, action: 'REPLENISHMENT_INVOICES_IMPORTED', entity: 'REPLENISHMENT_REQUEST', details: { matched: results.filter((row) => row.matched).length, total: results.length }, ipAddress });
    return { results };
  }

  async partnerDetail(token: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { confirmationToken: token }, include: requestInclude, omit: { invoiceFile: true } });
    if (!request?.sourceDistributorId) throw new NotFoundException('This replenishment link is invalid or no longer available.');
    return request;
  }

  private async partnerActor(token: string) {
    const request = await this.prisma.replenishmentRequest.findUnique({ where: { confirmationToken: token }, select: { id: true, sourceDistributorId: true } });
    if (!request?.sourceDistributorId) throw new NotFoundException('This replenishment link is invalid or no longer available.');
    const user = await this.prisma.user.findFirst({ where: { distributorId: request.sourceDistributorId, status: 'ACTIVE', roles: { some: { role: { key: 'DISTRIBUTOR_OWNER' } } } }, include: { roles: { include: { role: true } } } });
    if (!user) throw new ConflictException('The supplying partner owner account is not active.');
    const actor: SessionUser = { id: user.id, name: user.name, email: user.email, loginId: user.loginId, portal: 'DISTRIBUTOR', status: user.status, department: user.department, dataScope: user.dataScope, manager: null, distributorId: request.sourceDistributorId, assignedDistributorId: null, distributionPartner: null, permissions: [], roles: user.roles.map(({ role }) => ({ key: role.key, name: role.name })) };
    return { id: request.id, actor };
  }

  async partnerAction(token: string, dto: PartnerReplenishmentActionDto, ipAddress?: string) {
    const { id, actor } = await this.partnerActor(token);
    if (dto.action === 'approve') return this.approve(actor, id, dto, ipAddress);
    if (dto.action === 'reject') return this.reject(actor, id, dto, ipAddress);
    if (dto.action === 'pick') return this.warehouseStep(actor, id, 'PICKING', ipAddress);
    if (dto.action === 'pack') return this.warehouseStep(actor, id, 'PACKED', ipAddress);
    return this.fulfill(actor, id, dto, ipAddress);
  }

  async partnerInvoice(token: string, file: { buffer: Buffer; mimetype: string; originalname: string; size: number }, ipAddress?: string) {
    const { id, actor } = await this.partnerActor(token); return this.uploadInvoice(actor, id, file, ipAddress);
  }
}
