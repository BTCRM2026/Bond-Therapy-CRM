import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminVisitsDto, CompleteVisitDto, SaveRouteDto, StartVisitDto, StopStatusDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const stopInclude = {
  client: { select: { id: true, salonName: true, city: true, area: true, primaryContact: true, potential: true, latitude: true, longitude: true } },
  activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true } } } },
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

  private haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
    const toRad = (degrees: number) => degrees * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

  async startVisit(actor: SessionUser, dateStr: string, stopId: string, dto: StartVisitDto, file: { buffer: Buffer; mimetype: string; size: number }, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (stop.status !== 'PLANNED') throw new BadRequestException('This stop is no longer active.');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Capture a JPG, PNG, or WebP photo.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Photo must be 5 MB or smaller.');
    const settings = await this.prisma.operationsSettings.findUnique({ where: { id: 'default' }, select: { visitRadiusMeters: true } });
    const hasSalonLocation = stop.client.latitude != null && stop.client.longitude != null;
    const distanceMeters = hasSalonLocation ? this.haversineMeters(Number(stop.client.latitude), Number(stop.client.longitude), dto.latitude, dto.longitude) : null;
    const gpsVerified = distanceMeters == null ? null : distanceMeters <= (settings?.visitRadiusMeters ?? 150);
    const activity = await this.prisma.$transaction(async (tx) => {
      const visit = stop.activity ?? await tx.clientActivity.create({ data: { clientId: stop.clientId, type: 'VISIT', status: 'OPEN', createdById: actor.id, routeStopId: stop.id, checkInAt: new Date() } });
      await tx.visitProof.upsert({
        where: { activityId: visit.id },
        create: { activityId: visit.id, checkInPhoto: file.buffer, checkInPhotoMime: file.mimetype, checkInLatitude: dto.latitude, checkInLongitude: dto.longitude, distanceMeters, gpsVerified },
        update: { checkInPhoto: file.buffer, checkInPhotoMime: file.mimetype, checkInLatitude: dto.latitude, checkInLongitude: dto.longitude, distanceMeters, gpsVerified, capturedAt: new Date() },
      });
      if (route.status === 'DRAFT' || route.status === 'PLANNED') await tx.route.update({ where: { id: route.id }, data: { status: 'IN_PROGRESS' } });
      return visit;
    });
    await this.recordAudit(actor, 'ROUTE_VISIT_START', stopId, { distanceMeters, gpsVerified, mimeType: file.mimetype }, ipAddress);
    return activity;
  }

  async visitPhoto(actor: SessionUser, stopId: string) {
    this.ensureAccess(actor);
    const stop = await this.prisma.routeStop.findFirst({
      where: { id: stopId, ...(this.isAdmin(actor) ? {} : { route: { staffId: actor.id } }) },
      select: { activity: { select: { visitProof: true } } },
    });
    const proof = stop?.activity?.visitProof;
    if (!proof) throw new NotFoundException('Visit photo not found.');
    return { buffer: Buffer.from(proof.checkInPhoto), mime: proof.checkInPhotoMime };
  }

  async adminVisits(actor: SessionUser, query: AdminVisitsDto) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Field activity oversight is restricted to Super Admin.');
    const routeDate = query.date ? this.parseDate(query.date) : undefined;
    const gpsVerified = query.gps === 'verified' ? true : query.gps === 'outside' ? false : query.gps === 'skipped' ? null : undefined;
    const clientFilter = query.search || query.territory ? { client: { ...(query.search ? { salonName: { contains: query.search } } : {}), ...(query.territory ? { territory: query.territory } : {}) } } : {};
    const where: Prisma.RouteStopWhereInput = {
      activity: { isNot: null },
      ...(routeDate ? { route: { routeDate, ...(query.staffId ? { staffId: query.staffId } : {}) } } : query.staffId ? { route: { staffId: query.staffId } } : {}),
      ...(query.status ? { status: query.status as Prisma.EnumRouteStopStatusFilter } : {}),
      ...clientFilter,
      ...(gpsVerified !== undefined ? { activity: { visitProof: { gpsVerified } } } : {}),
    };
    const [items, staff, territoryRows] = await Promise.all([
      this.prisma.routeStop.findMany({ where, include: { route: { include: { staff: { select: { id: true, name: true } } } }, client: { select: { id: true, salonName: true, city: true, area: true, territory: true } }, activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true } } } } }, orderBy: { activity: { checkInAt: 'desc' } }, take: 200 }),
      this.prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.client.findMany({ where: { territory: { not: null } }, select: { territory: true }, distinct: ['territory'], orderBy: { territory: 'asc' } }),
    ]);
    return {
      summary: {
        total: items.length,
        completed: items.filter((item) => item.status === 'VISITED').length,
        pending: items.filter((item) => item.status === 'PLANNED').length,
        gpsVerified: items.filter((item) => item.activity?.visitProof?.gpsVerified === true).length,
        photoCaptured: items.filter((item) => Boolean(item.activity?.visitProof)).length,
        productive: items.filter((item) => item.activity?.visitOutcome === 'PRODUCTIVE').length,
        ordersGenerated: items.filter((item) => item.activity?.visitOutcome === 'ORDER_GENERATED').length,
      },
      items,
      filters: { staff, territories: territoryRows.map((row) => row.territory).filter(Boolean) },
    };
  }

  async visitEvidence(actor: SessionUser, stopId: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Field activity evidence is restricted to Super Admin.');
    const stop = await this.prisma.routeStop.findUnique({
      where: { id: stopId },
      include: { route: { include: { staff: { select: { id: true, name: true } } } }, client: true, activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true, checkInLatitude: true, checkInLongitude: true, checkInPhotoMime: true } } } } },
    });
    if (!stop?.activity) throw new NotFoundException('Visit evidence not found.');
    return stop;
  }

  async completeVisit(actor: SessionUser, dateStr: string, stopId: string, dto: CompleteVisitDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');

    if (!stop.activity?.visitProof) throw new BadRequestException('Start the visit with GPS and a check-in photo before completing it.');
    const activity = stop.activity;
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
