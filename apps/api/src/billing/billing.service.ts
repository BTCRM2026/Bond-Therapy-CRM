import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListInvoicesDto, RecordPaymentDto, UpdateBillingSettingsDto, UpdateInvoiceStatusDto } from './dto.js';
import { renderInvoicePdf } from './invoice-pdf.js';

const invoiceInclude = { order: { select: { id: true, orderNumber: true, salespersonId: true, salesperson: { select: { name: true } } } }, client: { select: { id: true, salonName: true, city: true } }, items: true, payments: { include: { recordedBy: { select: { id: true, name: true } } }, orderBy: { paymentDate: 'desc' as const } }, generatedBy: { select: { id: true, name: true } } } satisfies Prisma.InvoiceInclude;

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}
  private isAdmin(actor: SessionUser) { return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN'); }
  private isAccounts(actor: SessionUser) { return actor.portal === 'STAFF' && actor.roles.some((role) => role.key === 'ACCOUNTS_BILLING'); }
  private isSales(actor: SessionUser) { return actor.portal === 'STAFF' && actor.roles.some((role) => ['SALES_MANAGER', 'SALES_EXECUTIVE'].includes(role.key)); }
  private ensureBilling(actor: SessionUser) { if (!this.isAdmin(actor) && !this.isAccounts(actor)) throw new ForbiddenException('This action is restricted to Accounts.'); }
  private invoiceVisibility(actor: SessionUser): Prisma.InvoiceWhereInput {
    if (this.isAdmin(actor) || this.isAccounts(actor)) return {};
    if (this.isSales(actor)) return actor.dataScope === 'TEAM' ? { OR: [{ order: { salespersonId: actor.id } }, { order: { salesperson: { managerId: actor.id } } }] } : { order: { salespersonId: actor.id } };
    throw new ForbiddenException('Invoices are not available to this account.');
  }

  getSettings(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    return this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {}, omit: { logo: true, signature: true } });
  }

  async updateSettings(actor: SessionUser, dto: UpdateBillingSettingsDto, ipAddress?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    const clean = Object.fromEntries(Object.entries(dto).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || null : value]));
    const updated = await this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...clean, legalName: dto.legalName.trim(), tradeName: dto.tradeName.trim(), invoicePrefix: dto.invoicePrefix.trim().toUpperCase(), updatedById: actor.id }, update: { ...clean, legalName: dto.legalName.trim(), tradeName: dto.tradeName.trim(), invoicePrefix: dto.invoicePrefix.trim().toUpperCase(), updatedById: actor.id }, omit: { logo: true, signature: true } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'BILLING_SETTINGS_UPDATED', entity: 'BILLING_SETTINGS', entityId: updated.id, details: { invoicePrefix: updated.invoicePrefix, defaultGstRate: updated.defaultGstRate.toString(), paymentTerms: updated.defaultPaymentTermsDays }, ipAddress });
    return updated;
  }

  private ensureImage(file: { mimetype: string }) {
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) throw new ConflictException('Upload a PNG or JPG image.');
  }

  async uploadLogo(actor: SessionUser, file: { buffer: Buffer; mimetype: string }) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    this.ensureImage(file);
    await this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', logo: file.buffer, logoMime: file.mimetype }, update: { logo: file.buffer, logoMime: file.mimetype } });
    return { uploaded: true };
  }

  async logoAsset(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    const settings = await this.prisma.billingSettings.findUnique({ where: { id: 'default' }, select: { logo: true, logoMime: true } });
    if (!settings?.logo || !settings.logoMime) throw new NotFoundException('No logo uploaded.');
    return { buffer: Buffer.from(settings.logo), mime: settings.logoMime };
  }

  async uploadSignature(actor: SessionUser, file: { buffer: Buffer; mimetype: string }) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    this.ensureImage(file);
    await this.prisma.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default', signature: file.buffer, signatureMime: file.mimetype }, update: { signature: file.buffer, signatureMime: file.mimetype } });
    return { uploaded: true };
  }

  async signatureAsset(actor: SessionUser) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Billing settings are restricted to the administrator.');
    const settings = await this.prisma.billingSettings.findUnique({ where: { id: 'default' }, select: { signature: true, signatureMime: true } });
    if (!settings?.signature || !settings.signatureMime) throw new NotFoundException('No signature uploaded.');
    return { buffer: Buffer.from(settings.signature), mime: settings.signatureMime };
  }

  async list(actor: SessionUser, query: ListInvoicesDto) {
    await this.prisma.invoice.updateMany({ where: { dueDate: { lt: new Date() }, balanceDue: { gt: 0 }, status: { in: ['GENERATED', 'SENT'] } }, data: { status: 'OVERDUE' } });
    const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20)); const search = query.search?.trim();
    const where = { AND: [this.invoiceVisibility(actor), query.status ? { status: query.status } : {}, search ? { OR: [{ invoiceNumber: { contains: search } }, { client: { salonName: { contains: search } } }, { order: { orderNumber: { contains: search } } }] } : {}] } satisfies Prisma.InvoiceWhereInput;
    const [items, total] = await this.prisma.$transaction([this.prisma.invoice.findMany({ where, include: invoiceInclude, orderBy: { issuedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), this.prisma.invoice.count({ where })]);
    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  async detail(actor: SessionUser, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { AND: [{ id }, this.invoiceVisibility(actor)] }, include: invoiceInclude });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async generate(actor: SessionUser, orderId: string, ipAddress?: string) {
    this.ensureBilling(actor);
    const existing = await this.prisma.invoice.findUnique({ where: { orderId }, include: invoiceInclude });
    if (existing) return existing;
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { client: true, items: { include: { product: true } } } });
      if (!order) throw new NotFoundException('Approved order not found.');
      if (order.status !== 'APPROVED') throw new ConflictException('Only an approved order can be invoiced.');
      const settings = await tx.billingSettings.upsert({ where: { id: 'default' }, create: { id: 'default' }, update: {} });
      const now = new Date(); const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; const fy = `${String(fyStart).slice(-2)}-${String(fyStart + 1).slice(-2)}`;
      const counter = await tx.employeeCounter.upsert({ where: { key: `INV:${fy}` }, create: { key: `INV:${fy}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
      const invoiceNumber = `${settings.invoicePrefix}/${fy}/${String(counter.nextNumber).padStart(5, '0')}`;
      const dueDate = new Date(now); dueDate.setDate(dueDate.getDate() + settings.defaultPaymentTermsDays);
      const companySnapshot = { legalName: settings.legalName, tradeName: settings.tradeName, gstin: settings.gstin, pan: settings.pan, registeredAddress: settings.registeredAddress, city: settings.city, state: settings.state, stateCode: settings.stateCode, pincode: settings.pincode, phone: settings.phone, email: settings.email, website: settings.website, bankName: settings.bankName, accountName: settings.accountName, accountNumber: settings.accountNumber, ifsc: settings.ifsc, branch: settings.branch, upiId: settings.upiId, invoiceTerms: settings.invoiceTerms, footerNote: settings.footerNote };
      const customerSnapshot = { salonName: order.client.salonName, billingName: order.client.billingName, gstin: order.client.gstin, fullAddress: order.client.fullAddress, city: order.client.city, state: order.client.state, stateCode: order.client.stateCode, pincode: order.client.pincode, primaryContact: order.client.primaryContact, email: order.client.email };
      const invoice = await tx.invoice.create({ data: { invoiceNumber, orderId, clientId: order.clientId, companySnapshot, customerSnapshot, subtotal: order.subtotal, discountAmount: order.discountAmount, taxableAmount: order.taxableAmount, cgstAmount: order.cgstAmount, sgstAmount: order.sgstAmount, igstAmount: order.igstAmount, taxAmount: order.taxAmount, totalAmount: order.totalAmount, balanceDue: order.totalAmount, dueDate, generatedById: actor.id, notes: order.notes, items: { create: order.items.map((item) => ({ productId: item.productId, sku: item.product.sku, productName: item.product.name, hsnCode: item.product.hsnCode, unit: item.product.unit, quantity: item.quantity, unitPrice: item.unitPrice, discountAmount: item.discountAmount, taxableAmount: item.taxableAmount, gstRate: item.gstRate, taxAmount: item.taxAmount, lineTotal: item.lineTotal })) } }, include: invoiceInclude });
      await tx.order.update({ where: { id: orderId }, data: { status: 'INVOICE_GENERATED', version: { increment: 1 } } });
      return invoice;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INVOICE_GENERATED', entity: 'ORDER', entityId: orderId, details: { invoiceId: created.id, invoiceNumber: created.invoiceNumber, totalAmount: created.totalAmount.toString() }, ipAddress });
    return created;
  }

  async updateStatus(actor: SessionUser, id: string, dto: UpdateInvoiceStatusDto, ipAddress?: string) {
    this.ensureBilling(actor);
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (dto.status !== 'SENT' || invoice.status !== 'GENERATED') throw new ConflictException(`Cannot move an invoice from ${invoice.status} to ${dto.status}.`);
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() }, include: invoiceInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'INVOICE_SENT', entity: 'INVOICE', entityId: id, details: { from: invoice.status, to: updated.status }, ipAddress });
    return updated;
  }

  async recordPayment(actor: SessionUser, id: string, dto: RecordPaymentDto, ipAddress?: string) {
    this.ensureBilling(actor);
    const paymentDate = new Date(`${dto.paymentDate}T00:00:00.000Z`);
    if (Number.isNaN(paymentDate.getTime())) throw new ConflictException('Enter a valid payment date.');
    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({ where: { id } });
      if (!invoice) throw new NotFoundException('Invoice not found.');
      if (['PAID'].includes(invoice.status)) throw new ConflictException('This invoice is already paid.');
      const balance = Number(invoice.balanceDue); if (dto.amount > balance) throw new ConflictException(`Payment cannot exceed the remaining balance of INR ${balance.toFixed(2)}.`);
      const nextPaid = Number(invoice.amountPaid) + dto.amount; const nextBalance = Math.max(0, Number(invoice.totalAmount) - nextPaid); const status: InvoiceStatus = nextBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
      const payment = await tx.payment.create({ data: { invoiceId: id, paymentDate, amount: dto.amount, mode: dto.mode, reference: dto.reference?.trim() || null, notes: dto.notes?.trim() || null, recordedById: actor.id } });
      const updated = await tx.invoice.update({ where: { id }, data: { amountPaid: nextPaid, balanceDue: nextBalance, status, paidAt: nextBalance === 0 ? new Date() : null }, include: invoiceInclude });
      return { payment, invoice: updated };
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'PAYMENT_RECORDED', entity: 'INVOICE', entityId: id, details: { paymentId: result.payment.id, amount: dto.amount, mode: dto.mode, remaining: result.invoice.balanceDue.toString() }, ipAddress });
    return result.invoice;
  }

  async pdf(actor: SessionUser, id: string) {
    const invoice = await this.detail(actor, id);
    const settings = await this.prisma.billingSettings.findUnique({ where: { id: 'default' }, select: { logo: true, logoMime: true, signature: true, signatureMime: true, accountManagerName: true, accountManagerTitle: true } });
    const branding = settings ? { logo: settings.logo ? Buffer.from(settings.logo) : undefined, signature: settings.signature ? Buffer.from(settings.signature) : undefined, accountManagerName: settings.accountManagerName, accountManagerTitle: settings.accountManagerTitle } : undefined;
    return { filename: `${invoice.invoiceNumber.replaceAll('/', '-')}.pdf`, buffer: await renderInvoicePdf(invoice, branding) };
  }
}
