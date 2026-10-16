import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StaffRequestStatus } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRequestDto, DecideRequestDto, ListRequestsDto } from './dto.js';

const STATUSES: StaffRequestStatus[] = ['SUBMITTED', 'NEEDS_INFO', 'APPROVED', 'REJECTED'];
const detailInclude = {
  requester: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  events: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { id: true, name: true } } } },
} satisfies Prisma.StaffRequestInclude;
type Detail = Prisma.StaffRequestGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class StaffRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (!this.isAdmin(actor) && actor.portal !== 'STAFF') throw new ForbiddenException('Requests are not available to this account.');
  }

  private present(request: Detail) {
    return {
      id: request.id,
      requestNumber: request.requestNumber,
      title: request.title,
      details: request.details,
      status: request.status,
      requester: request.requester,
      decidedBy: request.decidedBy,
      decidedAt: request.decidedAt,
      approvedValue: request.approvedValue,
      validUntil: request.validUntil,
      createdAt: request.createdAt,
      events: request.events.map((event) => ({ id: event.id, type: event.type, comment: event.comment, createdAt: event.createdAt, actorId: event.actor.id, actorName: event.actor.name })),
    };
  }

  // Staff only ever see their own requests; the Super Admin sees everyone's.
  private async load(actor: SessionUser, id: string) {
    this.ensureAccess(actor);
    const request = await this.prisma.staffRequest.findUnique({ where: { id }, include: detailInclude });
    if (!request || (!this.isAdmin(actor) && request.requesterId !== actor.id)) throw new NotFoundException('Request not found.');
    return request;
  }

  async list(actor: SessionUser, query: ListRequestsDto) {
    this.ensureAccess(actor);
    const admin = this.isAdmin(actor);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const scope: Prisma.StaffRequestWhereInput = admin ? {} : { requesterId: actor.id };
    const search = query.search?.trim();
    const where: Prisma.StaffRequestWhereInput = {
      ...scope,
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { OR: [{ title: { contains: search } }, { requestNumber: { contains: search } }, { details: { contains: search } }, ...(admin ? [{ requester: { name: { contains: search } } }] : [])] } : {}),
    };
    const [items, total, grouped] = await Promise.all([
      this.prisma.staffRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, requestNumber: true, title: true, status: true, createdAt: true, decidedAt: true, requester: { select: { id: true, name: true } } } }),
      this.prisma.staffRequest.count({ where }),
      this.prisma.staffRequest.groupBy({ by: ['status'], where: scope, _count: { _all: true } }),
    ]);
    const counts = Object.fromEntries(STATUSES.map((status) => [status, grouped.find((row) => row.status === status)?._count._all ?? 0])) as Record<StaffRequestStatus, number>;
    return { items, total, page, pageSize, hasMore: page * pageSize < total, counts, viewer: admin ? 'ADMIN' : 'STAFF' };
  }

  async detail(actor: SessionUser, id: string) {
    return this.present(await this.load(actor, id));
  }

  async create(actor: SessionUser, dto: CreateRequestDto, ipAddress?: string) {
    if (actor.portal !== 'STAFF') throw new ForbiddenException('Requests are raised from the staff portal.');
    const year = new Date().getUTCFullYear();
    const created = await this.prisma.$transaction(async (tx) => {
      const counter = await tx.employeeCounter.upsert({ where: { key: `REQ:${year}` }, create: { key: `REQ:${year}`, nextNumber: 1 }, update: { nextNumber: { increment: 1 } } });
      return tx.staffRequest.create({
        data: { requestNumber: `REQ-${year}-${String(counter.nextNumber).padStart(4, '0')}`, title: dto.title, details: dto.details, requesterId: actor.id, events: { create: { actorId: actor.id, type: 'SUBMITTED' } } },
        include: detailInclude,
      });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STAFF_REQUEST_CREATE', entity: 'STAFF_REQUEST', entityId: created.id, details: { requestNumber: created.requestNumber }, ipAddress });
    return this.present(created);
  }

  async decide(actor: SessionUser, id: string, dto: DecideRequestDto, ipAddress?: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Only an administrator can decide on requests.');
    const request = await this.load(actor, id);
    if (request.status === 'APPROVED' || request.status === 'REJECTED') throw new BadRequestException('This request has already been closed.');
    const comment = dto.comment?.trim() || null;
    if (dto.decision === 'REJECT' && !comment) throw new BadRequestException('Add the reason for rejecting this request.');
    if (dto.decision === 'NEED_INFO' && !comment) throw new BadRequestException('Tell the requester what information you need.');
    const approving = dto.decision === 'APPROVE';
    const validUntil = approving && dto.validUntil ? new Date(dto.validUntil) : null;
    if (validUntil && Number.isNaN(validUntil.getTime())) throw new BadRequestException('Enter a valid validity date.');

    const status: StaffRequestStatus = approving ? 'APPROVED' : dto.decision === 'REJECT' ? 'REJECTED' : 'NEEDS_INFO';
    const closing = status !== 'NEEDS_INFO';
    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: {
        status,
        decidedById: closing ? actor.id : null,
        decidedAt: closing ? new Date() : null,
        approvedValue: approving ? dto.approvedValue?.trim() || null : null,
        validUntil,
        events: { create: { actorId: actor.id, type: approving ? 'APPROVED' : dto.decision === 'REJECT' ? 'REJECTED' : 'INFO_REQUESTED', comment } },
      },
      include: detailInclude,
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: `STAFF_REQUEST_${dto.decision}`, entity: 'STAFF_REQUEST', entityId: id, details: { requestNumber: request.requestNumber, status }, ipAddress });
    return this.present(updated);
  }

  async reply(actor: SessionUser, id: string, comment: string, ipAddress?: string) {
    const request = await this.load(actor, id);
    if (request.requesterId !== actor.id) throw new ForbiddenException('Only the person who raised this request can reply.');
    if (request.status !== 'NEEDS_INFO') throw new BadRequestException('This request is not waiting for more information.');
    const updated = await this.prisma.staffRequest.update({
      where: { id },
      data: { status: 'SUBMITTED', events: { create: { actorId: actor.id, type: 'REPLIED', comment: comment.trim() } } },
      include: detailInclude,
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'STAFF_REQUEST_REPLY', entity: 'STAFF_REQUEST', entityId: id, details: { requestNumber: request.requestNumber }, ipAddress });
    return this.present(updated);
  }
}
