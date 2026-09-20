import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientActivityStatus, ClientActivityType, ClientCategory, Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ClientActivityDto, ClientDto, ListClientsDto } from './dto.js';

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
    return {
      client, activities, openActions, nextVisit,
      salesSnapshot: { lifetimeSales: null, currentYearSales: null, averageOrderValue: null, lastOrder: null, outstanding: null, overdue: null },
      productSnapshot: { purchased: [], lastProduct: null, mostPurchased: null, demos: [], samples: [] },
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
      fullAddress: dto.fullAddress?.trim() || null, area: dto.area?.trim() || null, city: dto.city.trim(), pincode: dto.pincode?.trim() || null, googleMapsUrl: dto.googleMapsUrl?.trim() || null,
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
    const activity = await this.prisma.clientActivity.create({ data: { clientId: client.id, type: dto.type, status: dto.status ?? 'OPEN', purpose: dto.purpose?.trim() || null, personMet: dto.personMet?.trim() || null, note: dto.note?.trim() || null, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null, completedAt: dto.status === 'COMPLETED' ? new Date() : null, createdById: actor.id }, include: { createdBy: { select: { id: true, name: true } } } });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'CLIENT_ACTIVITY_CREATE', entity: 'CLIENT_ACTIVITY', entityId: activity.id, details: { clientId, type: activity.type }, ipAddress });
    return activity;
  }
}
