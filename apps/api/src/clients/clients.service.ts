import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientActivityStatus, ClientActivityType, ClientCategory, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ClientActivityDto, ClientDto, ListActivitiesDto, ListClientsDto, UpdateActivityStatusDto } from './dto.js';

const managedRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE', 'ACCOUNTS_BILLING', 'WAREHOUSE', 'DEMO_TEAM']);
const clientInclude = {
  assignedSalesperson: { select: { id: true, name: true, loginId: true } },
  assignedTrainer: { select: { id: true, name: true, loginId: true } },
  distributor: { select: { id: true, businessName: true } },
  beat: { select: { id: true, name: true, visitFrequencyDays: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ClientInclude;

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => managedRoles.has(role.key))) throw new ForbiddenException('Clients are not available to this account.');
  }

  private visibility(actor: SessionUser): Prisma.ClientWhereInput {
    if (this.isAdmin(actor)) return {};
    const trainer = actor.roles.some((role) => role.key === 'DEMO_TEAM');
    if (trainer) return { OR: [{ assignedTrainerId: actor.id }, { createdById: actor.id }] };
    if (actor.dataScope === 'TEAM') return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }, { assignedSalesperson: { managerId: actor.id } }] };
    return { OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }] };
  }

  private whereFor(actor: SessionUser, id: string): Prisma.ClientWhereInput {
    return { AND: [{ id }, this.visibility(actor)] };
  }

  private async getVisible(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const client = await this.prisma.client.findFirst({ where: this.whereFor(actor, id), include: clientInclude });
    if (!client) throw new NotFoundException('Salon not found or you do not have access to it.');
    return client;
  }

  async list(actor: SessionUser, query: ListClientsDto) {
    this.ensureAccess(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const search = query.search?.trim();
    const filters: Prisma.ClientWhereInput[] = [this.visibility(actor)];
    if (search) filters.push({ OR: [
      { salonName: { contains: search } }, { ownerName: { contains: search } }, { primaryContact: { contains: search } },
      { city: { contains: search } }, { area: { contains: search } },
    ] });
    if (query.status) filters.push({ status: query.status });
    if (query.category) filters.push({ category: query.category });
    if (query.clientType) filters.push({ clientType: query.clientType });
    if (query.potential) filters.push({ potential: query.potential });
    if (query.customerSegment) filters.push({ customerSegment: query.customerSegment });
    if (query.city) filters.push({ city: { contains: query.city.trim() } });
    const where = { AND: filters } satisfies Prisma.ClientWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({ where, include: clientInclude, orderBy: [{ updatedAt: 'desc' }, { salonName: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.client.count({ where }),
    ]);
    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  async detail(actor: SessionUser, id: string) {
    const client = await this.getVisible(actor, id);
    const now = new Date();
    const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = new Date(`${fyYear}-04-01T00:00:00+05:30`);
    const [activities, orders, invoices, exchanges] = await Promise.all([
      this.prisma.clientActivity.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 200, include: { createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } } }),
      this.prisma.order.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 200, include: { items: { include: { product: { select: { id: true, name: true, sku: true } }, exchangeItems: { where: { exchange: { status: { not: 'REJECTED' } } }, select: { requestedQuantity: true, approvedQuantity: true } } } }, invoice: { select: { id: true, invoiceNumber: true } } } }),
      this.prisma.invoice.findMany({ where: { clientId: client.id }, orderBy: { issuedAt: 'desc' }, take: 200, include: { payments: { orderBy: { paymentDate: 'desc' } }, items: { include: { product: { select: { id: true, name: true, sku: true } } } }, order: { select: { orderNumber: true } } } }),
      this.prisma.exchangeRequest.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { requestedBy: { select: { name: true } }, items: { select: { id: true, orderItemId: true, requestedQuantity: true, approvedQuantity: true, receivedQuantity: true, reason: true, batchNumber: true, expiryDate: true, conditionPhotoMime: true, disposition: true, inspectionNotes: true, originalProduct: { select: { name: true, sku: true } }, replacementProduct: { select: { name: true, sku: true } } } } } }),
    ]);
    const nextVisit = activities.filter((item) => item.type === ClientActivityType.VISIT && item.status === ClientActivityStatus.OPEN && item.scheduledAt && item.scheduledAt >= now).sort((a, b) => Number(a.scheduledAt) - Number(b.scheduledAt))[0] ?? null;
    const openActions = activities.filter((item) => item.status === ClientActivityStatus.OPEN).sort((a, b) => Number(a.scheduledAt ?? a.createdAt) - Number(b.scheduledAt ?? b.createdAt)).slice(0, 8);
    const currentYearSales = invoices.filter((invoice) => invoice.issuedAt >= fyStart).reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const lifetimeSales = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const overdue = invoices.filter((invoice) => invoice.dueDate < now && Number(invoice.balanceDue) > 0).reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);
    const paidOrders = orders.filter((order) => !['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', 'REJECTED', 'CANCELLED'].includes(order.status));
    const lastOrder = paidOrders[0] ?? null;
    const productMap = new Map<string, { productId: string | null; name: string; sku: string; quantity: number; value: number; dates: Date[] }>();
    for (const invoice of invoices) for (const item of invoice.items) {
      const key = item.productId ?? item.sku;
      const current = productMap.get(key) ?? { productId: item.productId, name: item.productName, sku: item.sku, quantity: 0, value: 0, dates: [] };
      current.quantity += item.quantity; current.value += Number(item.lineTotal); current.dates.push(invoice.issuedAt); productMap.set(key, current);
    }
    const products = [...productMap.values()].map((item) => {
      const dates = item.dates.sort((a, b) => a.getTime() - b.getTime());
      const intervals = dates.slice(1).map((date, index) => Math.max(1, Math.round((date.getTime() - dates[index].getTime()) / 86_400_000)));
      const averageReorderDays = intervals.length ? Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length) : null;
      const lastPurchasedAt = dates.at(-1)!;
      const daysSinceLastPurchase = Math.floor((now.getTime() - lastPurchasedAt.getTime()) / 86_400_000);
      return { productId: item.productId, name: item.name, sku: item.sku, totalQuantity: item.quantity, totalValue: item.value, firstPurchasedAt: dates[0], lastPurchasedAt, averageReorderDays, daysSinceLastPurchase, reorderDue: averageReorderDays != null && daysSinceLastPurchase >= averageReorderDays };
    }).sort((a, b) => b.totalValue - a.totalValue);
    const pendingExchange = exchanges.find((item) => !['REJECTED', 'CLOSED'].includes(item.status));
    const overdueFollowUp = activities.find((item) => item.type === 'FOLLOW_UP' && item.status === 'OPEN' && item.scheduledAt && item.scheduledAt < now);
    const lastCompletedVisit = activities.find((item) => item.type === 'VISIT' && item.status === 'COMPLETED');
    const visitFrequencyDays = client.beat?.visitFrequencyDays ?? 30;
    const visitOverdue = !lastCompletedVisit || (now.getTime() - (lastCompletedVisit.completedAt ?? lastCompletedVisit.createdAt).getTime()) / 86_400_000 > visitFrequencyDays;
    const daysSinceOrder = lastOrder ? Math.floor((now.getTime() - lastOrder.createdAt.getTime()) / 86_400_000) : null;
    const alerts = [
      overdue > 0 ? { type: 'PAYMENT_OVERDUE', label: `₹${overdue.toLocaleString('en-IN')} payment overdue`, level: 'danger' } : null,
      daysSinceOrder == null || daysSinceOrder >= 60 ? { type: 'NO_RECENT_ORDER', label: daysSinceOrder == null ? 'No order placed yet' : `No order for ${daysSinceOrder} days`, level: 'warning' } : null,
      overdueFollowUp ? { type: 'FOLLOW_UP_OVERDUE', label: 'Follow-up is overdue', level: 'warning' } : null,
      pendingExchange ? { type: 'EXCHANGE_PENDING', label: `${pendingExchange.exchangeNumber} needs attention`, level: 'info' } : null,
      visitOverdue ? { type: 'VISIT_OVERDUE', label: 'Salon visit is due', level: 'warning' } : null,
    ].filter(Boolean);
    const nextAction = overdue > 0 ? { label: 'Recover overdue payment', date: null }
      : overdueFollowUp ? { label: overdueFollowUp.purpose || 'Complete overdue follow-up', date: overdueFollowUp.scheduledAt }
      : pendingExchange ? { label: `Progress ${pendingExchange.exchangeNumber}`, date: null }
      : products.find((item) => item.reorderDue) ? { label: `Reorder ${products.find((item) => item.reorderDue)!.name}`, date: null }
      : nextVisit ? { label: nextVisit.purpose || 'Upcoming salon visit', date: nextVisit.scheduledAt }
      : { label: 'Schedule the next salon visit', date: null };
    const timeline = [
      ...activities.map((item) => ({ id: `activity:${item.id}`, kind: 'ACTIVITY', date: item.completedAt ?? item.scheduledAt ?? item.createdAt, title: item.type.replaceAll('_', ' '), summary: item.note || item.purpose || item.personMet || 'Salon activity', status: item.status, actor: item.createdBy.name, referenceId: item.id })),
      ...orders.map((item) => ({ id: `order:${item.id}`, kind: 'ORDER', date: item.createdAt, title: item.orderNumber, summary: `${item.items.map((line) => `${line.product.name} × ${line.quantity}`).join(', ')} · ₹${Number(item.totalAmount).toLocaleString('en-IN')}`, status: item.status, actor: null, referenceId: item.id })),
      ...invoices.map((item) => ({ id: `invoice:${item.id}`, kind: 'INVOICE', date: item.issuedAt, title: item.invoiceNumber, summary: `Invoice ₹${Number(item.totalAmount).toLocaleString('en-IN')} · Balance ₹${Number(item.balanceDue).toLocaleString('en-IN')}`, status: item.status, actor: null, referenceId: item.id })),
      ...invoices.flatMap((invoice) => invoice.payments.map((item) => ({ id: `payment:${item.id}`, kind: 'PAYMENT', date: item.paymentDate, title: `Payment for ${invoice.invoiceNumber}`, summary: `₹${Number(item.amount).toLocaleString('en-IN')} via ${item.mode.replaceAll('_', ' ')}`, status: 'RECORDED', actor: null, referenceId: invoice.id }))),
      ...exchanges.map((item) => ({ id: `exchange:${item.id}`, kind: 'EXCHANGE', date: item.createdAt, title: item.exchangeNumber, summary: item.items.map((line) => `${line.originalProduct.name} × ${line.requestedQuantity}`).join(', '), status: item.status, actor: item.requestedBy.name, referenceId: item.id })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      client, activities: activities.slice(0, 10), allActivities: activities, openActions, nextVisit, alerts, nextAction, timeline,
      salesSnapshot: {
        lifetimeSales, currentYearSales, averageOrderValue: invoices.length ? lifetimeSales / invoices.length : 0,
        lastOrder: lastOrder ? { id: lastOrder.id, orderNumber: lastOrder.orderNumber, createdAt: lastOrder.createdAt, totalAmount: Number(lastOrder.totalAmount), status: lastOrder.status } : null,
        outstanding, overdue, financialYear: `${fyYear}-${String(fyYear + 1).slice(-2)}`,
      },
      productSnapshot: { products, mostPurchased: products[0]?.name ?? null, demos: activities.filter((item) => item.type === 'DEMO'), samples: activities.filter((item) => item.type === 'SAMPLE') },
      orders, invoices, exchanges,
      exchangeEligibleOrders: orders.filter((order) => ['DELIVERED', 'DISTRIBUTOR_FULFILLED'].includes(order.status) && order.invoice).map((order) => ({ id: order.id, orderNumber: order.orderNumber, createdAt: order.createdAt, invoice: order.invoice, items: order.items.map((item) => ({ id: item.id, product: item.product, deliveredQuantity: item.quantity, exchangedQuantity: item.exchangeItems.reduce((sum, exchangeItem) => sum + (exchangeItem.approvedQuantity ?? exchangeItem.requestedQuantity), 0) })) })),
      growth: { estimatedMonthlyBusiness: client.estimatedMonthlyBusiness == null ? null : Number(client.estimatedMonthlyBusiness), recommendation: nextAction.label },
    };
  }

  private async validateAssignments(actor: SessionUser, dto: ClientDto) {
    const trainer = actor.roles.some((role) => role.key === 'DEMO_TEAM');
    const assignedSalespersonId = this.isAdmin(actor) ? dto.assignedSalespersonId?.trim() || null : trainer ? null : actor.id;
    const assignedTrainerId = this.isAdmin(actor) ? dto.assignedTrainerId?.trim() || null : trainer ? actor.id : null;
    if (assignedSalespersonId) {
      const salesperson = await this.prisma.user.findFirst({ where: { id: assignedSalespersonId, status: 'ACTIVE', roles: { some: { role: { key: { in: ['SALES_MANAGER', 'SALES_EXECUTIVE'] }, isActive: true } } } }, select: { id: true } });
      if (!salesperson) throw new ForbiddenException('Select an active sales team member.');
    }
    if (assignedTrainerId) {
      const trainerUser = await this.prisma.user.findFirst({ where: { id: assignedTrainerId, status: 'ACTIVE', roles: { some: { role: { key: 'DEMO_TEAM', isActive: true } } } }, select: { id: true } });
      if (!trainerUser) throw new ForbiddenException('Select an active trainer.');
    }
    if (dto.distributorId) {
      const distributor = await this.prisma.distributor.findUnique({ where: { id: dto.distributorId }, select: { id: true } });
      if (!distributor) throw new ForbiddenException('Select a valid distributor.');
    }
    return { assignedSalespersonId, assignedTrainerId };
  }

  private data(dto: ClientDto, assignments: { assignedSalespersonId: string | null; assignedTrainerId: string | null }, locationStamp?: { locationSetAt: Date; locationSetById: string }) {
    return {
      salonName: dto.salonName.trim(), category: dto.category, clientType: dto.clientType ?? 'NEW_CLIENT', status: dto.status ?? 'ACTIVE', ownerName: dto.ownerName?.trim() || null, managerName: dto.managerName?.trim() || null,
      primaryContact: dto.primaryContact.trim(), whatsappNumber: dto.whatsappNumber?.trim() || null, email: dto.email?.trim().toLowerCase() || null, keyProfessional: dto.keyProfessional?.trim() || null,
      fullAddress: dto.fullAddress?.trim() || null, billingName: dto.billingName?.trim() || null, gstin: dto.gstin?.trim().toUpperCase() || null, state: dto.state?.trim() || null, stateCode: dto.stateCode?.trim() || null, area: dto.area?.trim() || null, city: dto.city.trim(), pincode: dto.pincode?.trim() || null, googleMapsUrl: dto.googleMapsUrl?.trim() || null, latitude: dto.latitude, longitude: dto.longitude, ...locationStamp,
      chairCount: dto.chairCount, staffCount: dto.staffCount, stylistCount: dto.stylistCount, approximateDailyCustomers: dto.approximateDailyCustomers, potential: dto.potential, customerSegment: dto.customerSegment,
      estimatedMonthlyBusiness: dto.estimatedMonthlyBusiness, purchasingFrequency: dto.purchasingFrequency?.trim() || null, territory: dto.territory?.trim() || null, routeBeat: dto.routeBeat?.trim() || null,
      businessPotentialRating: dto.businessPotentialRating, relationshipRating: dto.relationshipRating, paymentBehaviourRating: dto.paymentBehaviourRating, productOpportunityRating: dto.productOpportunityRating, overallRating: dto.overallRating,
      assignedSalespersonId: assignments.assignedSalespersonId, assignedTrainerId: assignments.assignedTrainerId, distributorId: dto.distributorId || null,
    };
  }

  private async possibleDuplicates(actor: SessionUser, dto: ClientDto) {
    return this.prisma.client.findMany({ where: { AND: [this.visibility(actor), { OR: [{ primaryContact: dto.primaryContact.trim() }, { AND: [{ salonName: dto.salonName.trim() }, { city: dto.city.trim() }] }] }] }, select: { id: true, salonName: true, city: true, primaryContact: true }, take: 3 });
  }

  async create(actor: SessionUser, dto: ClientDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const duplicates = await this.possibleDuplicates(actor, dto);
    if (duplicates.length && !dto.continueOnDuplicate) throw new ConflictException({ message: 'Possible existing salon found. Review it before continuing.', candidates: duplicates });
    const assignments = await this.validateAssignments(actor, dto);
    const locationStamp = dto.latitude != null && dto.longitude != null ? { locationSetAt: new Date(), locationSetById: actor.id } : undefined;
    const client = await this.prisma.client.create({ data: { ...this.data(dto, assignments, locationStamp), createdById: actor.id }, include: clientInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CLIENT_CREATE', entity: 'CLIENT', entityId: client.id, details: { salonName: client.salonName }, ipAddress });
    return client;
  }

  async update(actor: SessionUser, id: string, dto: ClientDto, ipAddress?: string) {
    const existing = await this.getVisible(actor, id);
    if (!this.isAdmin(actor) && dto.assignedSalespersonId !== undefined) throw new ForbiddenException('Salesperson assignment is managed by authorized administrators.');
    if (dto.version !== undefined && dto.version !== existing.version) throw new ConflictException('This salon changed since you opened it. Refresh before saving.');
    const changingLocation = dto.latitude !== undefined || dto.longitude !== undefined;
    const locationLocked = existing.latitude != null && existing.longitude != null;
    if (changingLocation && locationLocked && !this.isAdmin(actor)) throw new ForbiddenException('This salon’s location is locked once set. Ask an administrator to update it.');
    const locationStamp = changingLocation && dto.latitude != null && dto.longitude != null ? { locationSetAt: new Date(), locationSetById: actor.id } : undefined;
    const assignments = await this.validateAssignments(actor, dto);
    const client = await this.prisma.client.update({ where: { id, version: existing.version }, data: { ...this.data(dto, assignments, locationStamp), version: { increment: 1 } }, include: clientInclude }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ConflictException('This salon changed since you opened it. Refresh before saving.'); throw error; });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CLIENT_UPDATE', entity: 'CLIENT', entityId: id, details: { changes: dto }, ipAddress });
    return client;
  }

  async addActivity(actor: SessionUser, clientId: string, dto: ClientActivityDto, ipAddress?: string) {
    const client = await this.getVisible(actor, clientId);
    if (dto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({ where: { id: dto.assignedToId, status: 'ACTIVE' }, select: { id: true } });
      if (!assignee) throw new ForbiddenException('Select an active team member to assign.');
    }
    const activity = await this.prisma.clientActivity.create({
      data: {
        clientId: client.id, type: dto.type, status: dto.status ?? 'OPEN', purpose: dto.purpose?.trim() || null, personMet: dto.personMet?.trim() || null, note: dto.note?.trim() || null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, completedAt: dto.status === 'COMPLETED' ? new Date() : null, createdById: actor.id,
        assignedToId: dto.assignedToId || null, attendeeCount: dto.attendeeCount ?? null, requestedProducts: dto.requestedProducts ? (dto.requestedProducts as unknown as Prisma.InputJsonValue) : undefined, sampleGiven: dto.sampleGiven ?? false, nextAction: dto.nextAction?.trim() || null,
      },
      include: { createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CLIENT_ACTIVITY_CREATE', entity: 'CLIENT_ACTIVITY', entityId: activity.id, details: { clientId, type: activity.type }, ipAddress });
    return activity;
  }

  async listActivities(actor: SessionUser, query: ListActivitiesDto) {
    this.ensureAccess(actor);
    const now = new Date();
    const filters: Prisma.ClientActivityWhereInput[] = [{ client: this.visibility(actor) }];
    if (query.scope === 'overdue') filters.push({ status: 'OPEN', scheduledAt: { lt: now } });
    else if (query.scope === 'all') { /* no extra status filter */ }
    else filters.push({ status: 'OPEN' });
    if (query.type) filters.push({ type: query.type });
    const where = { AND: filters } satisfies Prisma.ClientActivityWhereInput;
    return this.prisma.clientActivity.findMany({
      where,
      include: { client: { select: { id: true, salonName: true, city: true, primaryContact: true } }, createdBy: { select: { id: true, name: true } }, assignedTo: { select: { id: true, name: true } } },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async updateActivityStatus(actor: SessionUser, id: string, dto: UpdateActivityStatusDto) {
    this.ensureAccess(actor);
    const activity = await this.prisma.clientActivity.findFirst({ where: { AND: [{ id }, { client: this.visibility(actor) }] } });
    if (!activity) throw new NotFoundException('Activity not found or you do not have access to it.');
    return this.prisma.clientActivity.update({
      where: { id },
      data: { status: dto.status, note: dto.note?.trim() || activity.note, completedAt: dto.status === 'COMPLETED' ? new Date() : activity.completedAt, outcome: dto.outcome ?? activity.outcome, visitOutcome: dto.visitOutcome ?? activity.visitOutcome, sampleGiven: dto.sampleGiven ?? activity.sampleGiven, nextAction: dto.nextAction?.trim() || activity.nextAction },
      include: { client: { select: { id: true, salonName: true } } },
    });
  }

  async listTrainers(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { role: { key: 'DEMO_TEAM', isActive: true } } } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async territoryCoverage(actor: SessionUser) {
    this.ensureAccess(actor);
    const clients = await this.prisma.client.findMany({
      where: this.visibility(actor),
      select: {
        id: true, salonName: true, city: true, area: true, territory: true, routeBeat: true, potential: true, status: true,
        beat: { select: { id: true, name: true, visitFrequencyDays: true } },
        activities: { where: { type: 'VISIT', status: 'COMPLETED' }, orderBy: { checkOutAt: 'desc' }, take: 1, select: { checkOutAt: true, completedAt: true } },
      },
      orderBy: { salonName: 'asc' },
    });
    return clients.map((client) => ({
      id: client.id, salonName: client.salonName, city: client.city, area: client.area,
      territory: client.beat?.name ?? client.territory, routeBeat: client.routeBeat,
      beatId: client.beat?.id ?? null, visitFrequencyDays: client.beat?.visitFrequencyDays ?? null,
      potential: client.potential, status: client.status, lastVisitAt: client.activities[0]?.checkOutAt ?? client.activities[0]?.completedAt ?? null,
    }));
  }
}
