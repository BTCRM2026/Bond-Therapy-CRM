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
    const activities = await this.prisma.clientActivity.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 10, include: { createdBy: { select: { id: true, name: true } } } });
    const nextVisit = await this.prisma.clientActivity.findFirst({ where: { clientId: client.id, type: ClientActivityType.VISIT, status: ClientActivityStatus.OPEN, scheduledAt: { not: null, gte: new Date() } }, orderBy: { scheduledAt: 'asc' } });
    const openActions = await this.prisma.clientActivity.findMany({ where: { clientId: client.id, status: ClientActivityStatus.OPEN }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }], take: 8 });
    const financialStatuses = ['APPROVED', 'INVOICE_GENERATED', 'STOCK_RESERVED', 'PICKING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'] as const;
    const orderAggregate = await this.prisma.order.aggregate({ where: { clientId: client.id, status: { in: [...financialStatuses] } }, _sum: { totalAmount: true }, _avg: { totalAmount: true }, _count: true });
    const lastOrder = await this.prisma.order.findFirst({ where: { clientId: client.id, status: { in: [...financialStatuses] } }, orderBy: { createdAt: 'desc' }, select: { orderNumber: true, createdAt: true, totalAmount: true } });
    const recentOrders = await this.prisma.order.findMany({ where: { clientId: client.id, status: { in: [...financialStatuses] } }, orderBy: { createdAt: 'desc' }, take: 5, include: { items: { include: { product: { select: { name: true } } } } } });
    return {
      client, activities, openActions, nextVisit,
      salesSnapshot: {
        lifetimeSales: orderAggregate._count > 0 ? Number(orderAggregate._sum.totalAmount ?? 0) : null,
        currentYearSales: null,
        averageOrderValue: orderAggregate._count > 0 ? Number(orderAggregate._avg.totalAmount ?? 0) : null,
        lastOrder: lastOrder ? `${lastOrder.orderNumber} · ₹${Number(lastOrder.totalAmount).toLocaleString('en-IN')}` : null,
        outstanding: null,
        overdue: null,
      },
      productSnapshot: { purchased: recentOrders, lastProduct: recentOrders[0]?.items[0]?.product.name ?? null, mostPurchased: null, demos: [], samples: [] },
    };
  }

  private async validateAssignments(actor: SessionUser, dto: ClientDto) {
    const trainer = actor.roles.some((role) => role.key === 'DEMO_TEAM');
    const assignedSalespersonId = this.isAdmin(actor) ? dto.assignedSalespersonId?.trim() || null : trainer ? null : actor.id;
    const assignedTrainerId = this.isAdmin(actor) ? dto.assignedTrainerId?.trim() || null : trainer ? actor.id : null;
    if (assignedSalespersonId) {
      const salesperson = await this.prisma.user.findFirst({ where: { id: assignedSalespersonId, status: 'ACTIVE', roles: { some: { role: { key: { in: ['SALES_MANAGER', 'SALES_EXECUTIVE'], isActive: true } } } } }, select: { id: true } });
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

  private data(dto: ClientDto, assignments: { assignedSalespersonId: string | null; assignedTrainerId: string | null }) {
    return {
      salonName: dto.salonName.trim(), category: dto.category, status: dto.status ?? 'PROSPECT', ownerName: dto.ownerName?.trim() || null, managerName: dto.managerName?.trim() || null,
      primaryContact: dto.primaryContact.trim(), whatsappNumber: dto.whatsappNumber?.trim() || null, email: dto.email?.trim().toLowerCase() || null, keyProfessional: dto.keyProfessional?.trim() || null,
      fullAddress: dto.fullAddress?.trim() || null, billingName: dto.billingName?.trim() || null, gstin: dto.gstin?.trim().toUpperCase() || null, state: dto.state?.trim() || null, stateCode: dto.stateCode?.trim() || null, area: dto.area?.trim() || null, city: dto.city.trim(), pincode: dto.pincode?.trim() || null, googleMapsUrl: dto.googleMapsUrl?.trim() || null,
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
    const client = await this.prisma.client.create({ data: { ...this.data(dto, assignments), createdById: actor.id }, include: clientInclude });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CLIENT_CREATE', entity: 'CLIENT', entityId: client.id, details: { salonName: client.salonName }, ipAddress });
    return client;
  }

  async update(actor: SessionUser, id: string, dto: ClientDto, ipAddress?: string) {
    const existing = await this.getVisible(actor, id);
    if (!this.isAdmin(actor) && dto.assignedSalespersonId !== undefined) throw new ForbiddenException('Salesperson assignment is managed by authorized administrators.');
    if (dto.version !== undefined && dto.version !== existing.version) throw new ConflictException('This salon changed since you opened it. Refresh before saving.');
    const assignments = await this.validateAssignments(actor, dto);
    const client = await this.prisma.client.update({ where: { id, version: existing.version }, data: { ...this.data(dto, assignments), version: { increment: 1 } }, include: clientInclude }).catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ConflictException('This salon changed since you opened it. Refresh before saving.'); throw error; });
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
        assignedToId: dto.assignedToId || null, attendeeCount: dto.attendeeCount ?? null, requestedProducts: dto.requestedProducts ? (dto.requestedProducts as unknown as Prisma.InputJsonValue) : undefined,
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
      data: { status: dto.status, note: dto.note?.trim() || activity.note, completedAt: dto.status === 'COMPLETED' ? new Date() : activity.completedAt, outcome: dto.outcome ?? activity.outcome },
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
        activities: { where: { type: 'VISIT' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
      orderBy: { salonName: 'asc' },
    });
    return clients.map((client) => ({
      id: client.id, salonName: client.salonName, city: client.city, area: client.area, territory: client.territory, routeBeat: client.routeBeat,
      potential: client.potential, status: client.status, lastVisitAt: client.activities[0]?.createdAt ?? null,
    }));
  }
}
