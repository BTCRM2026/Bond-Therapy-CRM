import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CompleteVisitDto, SaveRouteDto, StopStatusDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const stopInclude = {
  client: { select: { id: true, salonName: true, city: true, area: true, primaryContact: true, potential: true } },
  activity: true,
} satisfies Prisma.RouteStopInclude;
const routeInclude = { stops: { orderBy: { sequence: 'asc' }, include: stopInclude } } satisfies Prisma.RouteInclude;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(actor: SessionUser) {
    return actor.portal === 'ADMIN' && actor.roles.some((role) => role.key === 'SUPER_ADMIN');
  }

  private ensureAccess(actor: SessionUser) {
    if (this.isAdmin(actor)) return;
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Route planning is not available to this account.');
  }

  private parseDate(value: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!match) throw new BadRequestException('Invalid date. Use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date.');
    return date;
  }

  async assignedSalons(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.client.findMany({
      where: { assignedSalespersonId: actor.id, status: { not: 'INACTIVE' } },
      select: { id: true, salonName: true, city: true, area: true, potential: true, beat: { select: { id: true, name: true } } },
      orderBy: { salonName: 'asc' },
    });
  }

  private async findOwnedRoute(actor: SessionUser, dateStr: string) {
    const date = this.parseDate(dateStr);
    const route = await this.prisma.route.findUnique({ where: { staffId_routeDate: { staffId: actor.id, routeDate: date } }, include: routeInclude });
    return { date, route };
  }

  async getRoute(actor: SessionUser, dateStr: string) {
    this.ensureAccess(actor);
    const { date, route } = await this.findOwnedRoute(actor, dateStr);
    if (route) return route;
    return { id: null, staffId: actor.id, routeDate: date, status: 'DRAFT' as const, notes: null, stops: [] };
  }

  async saveRoute(actor: SessionUser, dateStr: string, dto: SaveRouteDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.parseDate(dateStr);
    const clientIds = dto.stops.map((stop) => stop.clientId);
    if (new Set(clientIds).size !== clientIds.length) throw new BadRequestException('Each salon can only appear once in a route.');
    const owned = await this.prisma.client.count({ where: { id: { in: clientIds }, assignedSalespersonId: actor.id } });
    if (owned !== clientIds.length) throw new BadRequestException('You can only add salons assigned to you.');

    const existing = await this.prisma.route.findUnique({ where: { staffId_routeDate: { staffId: actor.id, routeDate: date } }, include: routeInclude });
    const route = existing ?? await this.prisma.route.create({ data: { staffId: actor.id, routeDate: date, status: 'DRAFT' }, include: routeInclude });

    const previousOrder = (existing?.stops ?? []).filter((stop) => stop.status !== 'REMOVED').sort((a, b) => a.sequence - b.sequence).map((stop) => stop.clientId);
    const previousClientIds = new Set(previousOrder);
    const nextClientIds = new Set(clientIds);
    const added = clientIds.filter((id) => !previousClientIds.has(id));
    const removed = previousOrder.filter((id) => !nextClientIds.has(id));
    const commonPreviousOrder = previousOrder.filter((id) => nextClientIds.has(id));
    const commonNextOrder = clientIds.filter((id) => previousClientIds.has(id));
    const reordered = commonPreviousOrder.length > 1 && commonPreviousOrder.join('|') !== commonNextOrder.join('|');

    await this.prisma.$transaction(async (tx) => {
      for (const stop of route.stops) {
        if (removed.includes(stop.clientId)) await tx.routeStop.update({ where: { id: stop.id }, data: { status: 'REMOVED' } });
      }
      for (const [index, input] of dto.stops.entries()) {
        const current = route.stops.find((stop) => stop.clientId === input.clientId && stop.status !== 'REMOVED');
        if (current) {
          await tx.routeStop.update({ where: { id: current.id }, data: { sequence: index, plannedTime: this.parsePlannedTime(input.plannedTime), note: input.note?.trim() || null } });
        } else {
          await tx.routeStop.create({ data: { routeId: route.id, clientId: input.clientId, sequence: index, plannedTime: this.parsePlannedTime(input.plannedTime), note: input.note?.trim() || null } });
        }
      }
      await tx.route.update({ where: { id: route.id }, data: { notes: dto.notes?.trim() || null } });
      if (added.length) await tx.routeChangeLog.create({ data: { routeId: route.id, changedById: actor.id, changeType: 'ADDED', newValue: added } });
      if (removed.length) await tx.routeChangeLog.create({ data: { routeId: route.id, changedById: actor.id, changeType: 'REMOVED', previousValue: removed } });
      if (reordered) await tx.routeChangeLog.create({ data: { routeId: route.id, changedById: actor.id, changeType: 'REORDERED', previousValue: commonPreviousOrder, newValue: commonNextOrder } });
    });

    await this.recordAudit(actor, 'ROUTE_SAVE', route.id, { date: dateStr, stopCount: dto.stops.length }, ipAddress);
    return this.getRoute(actor, dateStr);
  }

  private parsePlannedTime(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  async submit(actor: SessionUser, dateStr: string, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('No route found for this date.');
    if (!route.stops.some((stop) => stop.status !== 'REMOVED')) throw new BadRequestException('Add at least one salon before submitting the route.');
    const updated = await this.prisma.route.update({ where: { id: route.id }, data: { status: 'PLANNED' }, include: routeInclude });
    await this.recordAudit(actor, 'ROUTE_SUBMIT', route.id, { date: dateStr }, ipAddress);
    return updated;
  }

  async setStopStatus(actor: SessionUser, dateStr: string, stopId: string, dto: StopStatusDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (stop.status !== 'PLANNED') throw new BadRequestException('This stop has already been resolved.');

    await this.prisma.$transaction(async (tx) => {
      await tx.routeStop.update({ where: { id: stopId }, data: { status: dto.status, note: dto.reason?.trim() || stop.note } });
      await tx.routeChangeLog.create({ data: { routeId: route.id, changedById: actor.id, changeType: dto.status === 'REMOVED' ? 'REMOVED' : dto.status === 'RESCHEDULED' ? 'RESCHEDULED' : 'STATUS_CHANGE', clientId: stop.clientId, reason: dto.reason?.trim() || null, previousValue: { status: stop.status }, newValue: { status: dto.status } } });
      if (dto.status === 'RESCHEDULED' && dto.rescheduleDate) {
        const targetDate = this.parseDate(dto.rescheduleDate);
        const targetRoute = await tx.route.upsert({ where: { staffId_routeDate: { staffId: actor.id, routeDate: targetDate } }, create: { staffId: actor.id, routeDate: targetDate, status: 'DRAFT' }, update: {} });
        const maxSequence = await tx.routeStop.aggregate({ where: { routeId: targetRoute.id, status: { not: 'REMOVED' } }, _max: { sequence: true } });
        await tx.routeStop.create({ data: { routeId: targetRoute.id, clientId: stop.clientId, sequence: (maxSequence._max.sequence ?? -1) + 1, note: `Rescheduled from ${dateStr}${dto.reason ? `: ${dto.reason}` : ''}` } });
        await tx.routeChangeLog.create({ data: { routeId: targetRoute.id, changedById: actor.id, changeType: 'ADDED', clientId: stop.clientId, reason: `Rescheduled from ${dateStr}` } });
      }
    });
    await this.recomputeRouteStatus(route.id);
    await this.recordAudit(actor, 'ROUTE_STOP_STATUS', stopId, { status: dto.status, reason: dto.reason }, ipAddress);
    return this.getRoute(actor, dateStr);
  }

  async startVisit(actor: SessionUser, dateStr: string, stopId: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (stop.status !== 'PLANNED') throw new BadRequestException('This stop is no longer active.');

    if (stop.activity) return stop.activity;
    const activity = await this.prisma.clientActivity.create({ data: { clientId: stop.clientId, type: 'VISIT', status: 'OPEN', createdById: actor.id, routeStopId: stop.id, checkInAt: new Date() } });
    if (route.status === 'DRAFT' || route.status === 'PLANNED') await this.prisma.route.update({ where: { id: route.id }, data: { status: 'IN_PROGRESS' } });
    return activity;
  }

  async completeVisit(actor: SessionUser, dateStr: string, stopId: string, dto: CompleteVisitDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');

    const activity = stop.activity ?? await this.prisma.clientActivity.create({ data: { clientId: stop.clientId, type: 'VISIT', status: 'OPEN', createdById: actor.id, routeStopId: stop.id, checkInAt: new Date() } });
    const updated = await this.prisma.clientActivity.update({
      where: { id: activity.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        checkOutAt: new Date(),
        visitOutcome: dto.outcome,
        personMet: dto.personMet?.trim() || activity.personMet,
        purpose: dto.purpose?.trim() || activity.purpose,
        note: dto.note?.trim() || activity.note,
        sampleGiven: dto.sampleGiven ?? activity.sampleGiven,
        nextAction: dto.nextAction?.trim() || null,
      },
    });
    await this.prisma.routeStop.update({ where: { id: stopId }, data: { status: 'VISITED' } });
    await this.recomputeRouteStatus(route.id);
    await this.recordAudit(actor, 'ROUTE_VISIT_COMPLETE', stopId, { outcome: dto.outcome }, ipAddress);
    return updated;
  }

  private async recomputeRouteStatus(routeId: string) {
    const stops = await this.prisma.routeStop.findMany({ where: { routeId, status: { not: 'REMOVED' } } });
    if (!stops.length) return;
    const unresolved = stops.filter((stop) => stop.status === 'PLANNED');
    if (unresolved.length === stops.length) return;
    if (unresolved.length > 0) { await this.prisma.route.update({ where: { id: routeId }, data: { status: 'IN_PROGRESS' } }); return; }
    const allVisited = stops.every((stop) => stop.status === 'VISITED');
    await this.prisma.route.update({ where: { id: routeId }, data: { status: allVisited ? 'COMPLETED' : 'PARTIALLY_COMPLETED' } });
  }

  async adminOverview(actor: SessionUser, dateStr: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Route oversight is restricted to Super Admin.');
    const date = this.parseDate(dateStr);
    const routes = await this.prisma.route.findMany({
      where: { routeDate: date },
      include: { staff: { select: { id: true, name: true } }, stops: { where: { status: { not: 'REMOVED' } }, select: { status: true } } },
      orderBy: { staff: { name: 'asc' } },
    });
    return routes.map((route) => ({
      id: route.id,
      staff: route.staff,
      status: route.status,
      planned: route.stops.filter((stop) => stop.status === 'PLANNED').length,
      visited: route.stops.filter((stop) => stop.status === 'VISITED').length,
      unableToMeet: route.stops.filter((stop) => stop.status === 'UNABLE_TO_MEET').length,
      rescheduled: route.stops.filter((stop) => stop.status === 'RESCHEDULED').length,
      total: route.stops.length,
    }));
  }

  private async recordAudit(actor: SessionUser, action: string, entityId: string, details: unknown, ipAddress?: string) {
    await recordAudit(this.prisma, { actorId: actor.id, action, entity: 'ROUTE', entityId, details, ipAddress });
  }
}
