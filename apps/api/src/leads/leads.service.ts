import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LeadDto, ListLeadsDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const leadInclude = {
  assignedTo: { select: { id: true, name: true, loginId: true } },
  createdBy: { select: { id: true, name: true } },
  convertedClient: { select: { id: true, salonName: true } },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Leads are not available to this account.');
  }

  private visibility(actor: SessionUser): Prisma.LeadWhereInput {
    if (this.isAdmin(actor)) return {};
    if (actor.dataScope === 'TEAM') return { OR: [{ assignedToId: actor.id }, { assignedTo: { managerId: actor.id } }] };
    return { assignedToId: actor.id };
  }

  private async getVisible(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const lead = await this.prisma.lead.findFirst({ where: { AND: [{ id }, this.visibility(actor)] }, include: leadInclude });
    if (!lead) throw new NotFoundException('Lead not found or you do not have access to it.');
    return lead;
  }

  async list(actor: SessionUser, query: ListLeadsDto) {
    this.ensureAccess(actor);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
    const search = query.search?.trim();
    const filters: Prisma.LeadWhereInput[] = [this.visibility(actor)];
    if (search) filters.push({ OR: [{ salonName: { contains: search } }, { contactName: { contains: search } }, { phone: { contains: search } }, { city: { contains: search } }] });
    if (query.status) filters.push({ status: query.status });
    if (query.source) filters.push({ source: query.source });
    const where = { AND: filters } satisfies Prisma.LeadWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, include: leadInclude, orderBy: [{ updatedAt: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, page, pageSize, total, hasMore: page * pageSize < total };
  }

  async create(actor: SessionUser, dto: LeadDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const lead = await this.prisma.lead.create({
      data: {
        salonName: dto.salonName.trim(),
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone.trim(),
        whatsappNumber: dto.whatsappNumber?.trim() || null,
        city: dto.city?.trim() || null,
        area: dto.area?.trim() || null,
        source: dto.source ?? 'OTHER',
        status: dto.status ?? 'NEW',
        notes: dto.notes?.trim() || null,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
        assignedToId: actor.id,
        createdById: actor.id,
      },
      include: leadInclude,
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAD_CREATE', entity: 'LEAD', entityId: lead.id, details: { salonName: lead.salonName }, ipAddress });
    return lead;
  }

  async update(actor: SessionUser, id: string, dto: LeadDto, ipAddress?: string) {
    await this.getVisible(actor, id);
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        salonName: dto.salonName.trim(),
        contactName: dto.contactName?.trim() || null,
        phone: dto.phone.trim(),
        whatsappNumber: dto.whatsappNumber?.trim() || null,
        city: dto.city?.trim() || null,
        area: dto.area?.trim() || null,
        source: dto.source,
        status: dto.status,
        notes: dto.notes?.trim() || null,
        lostReason: dto.lostReason?.trim() || null,
        nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : null,
      },
      include: leadInclude,
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAD_UPDATE', entity: 'LEAD', entityId: id, details: { changes: dto }, ipAddress });
    return lead;
  }

  async convert(actor: SessionUser, id: string, ipAddress?: string) {
    const lead = await this.getVisible(actor, id);
    if (lead.convertedClientId) throw new ConflictException('This lead has already been converted.');
    const client = await this.prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          salonName: lead.salonName,
          category: 'SALON',
          status: 'PROSPECT',
          ownerName: lead.contactName,
          primaryContact: lead.phone,
          whatsappNumber: lead.whatsappNumber,
          area: lead.area,
          city: lead.city || 'Not set',
          assignedSalespersonId: lead.assignedToId,
          createdById: actor.id,
        },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'CONVERTED', convertedClientId: created.id } });
      return created;
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'LEAD_CONVERT', entity: 'LEAD', entityId: id, details: { clientId: client.id }, ipAddress });
    return client;
  }
}
