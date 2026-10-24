import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { markFieldWorked } from '../attendance/field-attendance.js';
import { DayRulesService } from '../day-rules/day-rules.service.js';
import { assertLiveCameraPhoto } from '../captures/live-photo.js';
import { CapturesService } from '../captures/captures.service.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminVisitsDto, CompleteSalonProfileDto, CompleteVisitDto, SalonLocationDto, SaveRouteDto, StartVisitDto, StopStatusDto, AddSalonByNameDto } from './dto.js';

// Arrival must be within this distance of the salon's saved location unless an administrator has set another radius.
export const DEFAULT_VISIT_RADIUS_METERS = 100;
// A phone reporting a worse GPS error than this has a weak fix. A weak fix cannot be saved as a salon's location,
// and it can check in only within WEAK_GPS_RADIUS_METERS of the salon (indoors the phone often cannot do better).
export const MAX_GPS_ACCURACY_METERS = 100;
export const WEAK_GPS_RADIUS_METERS = 50;

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const stopInclude = {
  client: { select: { id: true, salonName: true, city: true, area: true, primaryContact: true, potential: true, latitude: true, longitude: true, status: true, profileIncomplete: true } },
  activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true } } } },
} satisfies Prisma.RouteStopInclude;
const routeInclude = { stops: { orderBy: { sequence: 'asc' }, include: stopInclude } } satisfies Prisma.RouteInclude;

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService, private readonly captures: CapturesService, private readonly dayRules: DayRulesService) {}

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

  private istDateKey(at = new Date()) {
    return new Date(at.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
  }

  private checkAccuracy(accuracy?: number) {
    if (accuracy != null && accuracy > MAX_GPS_ACCURACY_METERS) throw new BadRequestException(`Your GPS signal is too weak (about ${Math.round(accuracy)} m off). Step outside or wait a few seconds, then try again.`);
  }

  // The salesperson plans a visit to a salon that has no client profile yet. It is saved as a prospect client assigned to them,
  // and they complete the profile (and save its location) when they reach the salon.
  async addSalonByName(actor: SessionUser, dto: AddSalonByNameDto, ipAddress?: string) {
    this.ensureAccess(actor);
    if (actor.portal !== 'STAFF') throw new ForbiddenException('Salons are added by the salesperson who will visit them.');
    const name = dto.name.trim().replace(/\s+/g, ' ');
    const city = dto.city.trim().replace(/\s+/g, ' ');
    const select = { id: true, salonName: true, city: true, area: true, potential: true, profileIncomplete: true, beat: { select: { id: true, name: true } } } as const;
    const mine = await this.prisma.client.findMany({ where: { status: { not: 'INACTIVE' }, OR: [{ assignedSalespersonId: actor.id }, { createdById: actor.id }] }, select });
    const same = mine.find((salon) => salon.salonName.trim().toLowerCase() === name.toLowerCase() && salon.city.trim().toLowerCase() === city.toLowerCase());
    if (same) return { ...same, existing: true };
    const created = await this.prisma.client.create({ data: { salonName: name, category: 'SALON', primaryContact: '', city, status: 'PROSPECT', profileIncomplete: true, assignedSalespersonId: actor.id, createdById: actor.id }, select });
    await this.recordAudit(actor, 'ROUTE_SALON_ADDED_BY_NAME', created.id, { salonName: name, city }, ipAddress);
    return { ...created, existing: false };
  }

  async assignedSalons(actor: SessionUser) {
    this.ensureAccess(actor);
    return this.prisma.client.findMany({
      where: {
        status: { not: 'INACTIVE' },
        OR: [
          { assignedSalespersonId: actor.id },
          { beat: { territory: { assignments: { some: { userId: actor.id, endDate: null } } } } },
        ],
      },
      select: { id: true, salonName: true, city: true, area: true, potential: true, profileIncomplete: true, beat: { select: { id: true, name: true } } },
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
    const settings = await this.prisma.operationsSettings.findUnique({ where: { id: 'default' }, select: { visitRadiusMeters: true } });
    const visitRadiusMeters = settings?.visitRadiusMeters ?? DEFAULT_VISIT_RADIUS_METERS;
    if (route) return { ...route, visitRadiusMeters };
    return { id: null, staffId: actor.id, routeDate: date, status: 'DRAFT' as const, notes: null, stops: [], visitRadiusMeters };
  }

  async saveRoute(actor: SessionUser, dateStr: string, dto: SaveRouteDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const date = this.parseDate(dateStr);
    const clientIds = dto.stops.map((stop) => stop.clientId);
    if (new Set(clientIds).size !== clientIds.length) throw new BadRequestException('Each salon can only appear once in a route.');
    const owned = await this.prisma.client.count({ where: { id: { in: clientIds }, status: { not: 'INACTIVE' }, OR: [{ assignedSalespersonId: actor.id }, { beat: { territory: { assignments: { some: { userId: actor.id, endDate: null } } } } }] } });
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
    // The day cannot start while the last working day's report is missing, until an administrator approves it.
    await this.dayRules.assertCanStart(actor.id);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (stop.status !== 'PLANNED') throw new BadRequestException('This stop is no longer active.');
    if (stop.client.profileIncomplete) throw new BadRequestException(`Add ${stop.client.salonName}’s client profile first, then check in.`);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Capture a JPG, PNG, or WebP photo.');
    if (file.size > 8 * 1024 * 1024) throw new BadRequestException('Photo must be 8 MB or smaller.');
    if (dateStr !== this.istDateKey()) throw new BadRequestException('You can check in only on the day of the route.');
    if (stop.client.latitude == null || stop.client.longitude == null) throw new BadRequestException(`${stop.client.salonName} has no saved location yet. Save the salon location first, then check in.`);
    const settings = await this.prisma.operationsSettings.findUnique({ where: { id: 'default' }, select: { visitRadiusMeters: true } });
    const salonRadius = settings?.visitRadiusMeters ?? DEFAULT_VISIT_RADIUS_METERS;
    // A missing accuracy is treated as weak, so leaving it out of the request cannot widen the radius.
    const weakGps = dto.accuracy == null || dto.accuracy > MAX_GPS_ACCURACY_METERS;
    const radius = weakGps ? Math.min(salonRadius, WEAK_GPS_RADIUS_METERS) : salonRadius;
    const distanceMeters = this.haversineMeters(Number(stop.client.latitude), Number(stop.client.longitude), dto.latitude, dto.longitude);
    if (distanceMeters > radius) {
      if (weakGps && distanceMeters <= salonRadius) throw new BadRequestException(`Your GPS signal is weak, so you must be within ${radius} m of ${stop.client.salonName} to check in. You appear to be about ${distanceMeters} m away. Wait a few seconds or stand near the door, then try again.`);
      throw new BadRequestException(`You are about ${distanceMeters} m from ${stop.client.salonName}. Move within ${radius} m of the salon to check in.`);
    }
    const gpsVerified = true;
    // The arrival photo must come from the in-app camera, must be new, and its camera pass is used up only now that every other check has passed.
    const photoHash = assertLiveCameraPhoto(file.buffer);
    const reused = await this.prisma.visitProof.findFirst({ where: { checkInPhotoHash: photoHash, ...(stop.activity ? { NOT: { activityId: stop.activity.id } } : {}) }, select: { id: true } });
    if (reused) throw new BadRequestException('This photo has already been used for another visit. Take a new photo at the salon.');
    await this.captures.consume(actor.id, dto.captureToken, 'VISIT_CHECK_IN', stopId);
    const activity = await this.prisma.$transaction(async (tx) => {
      const visit = stop.activity ?? await tx.clientActivity.create({ data: { clientId: stop.clientId, type: 'VISIT', status: 'OPEN', createdById: actor.id, routeStopId: stop.id, checkInAt: new Date() } });
      await tx.visitProof.upsert({
        where: { activityId: visit.id },
        create: { activityId: visit.id, checkInPhoto: file.buffer, checkInPhotoMime: file.mimetype, checkInPhotoHash: photoHash, checkInLatitude: dto.latitude, checkInLongitude: dto.longitude, distanceMeters, gpsVerified },
        update: { checkInPhoto: file.buffer, checkInPhotoMime: file.mimetype, checkInPhotoHash: photoHash, checkInLatitude: dto.latitude, checkInLongitude: dto.longitude, distanceMeters, gpsVerified, capturedAt: new Date() },
      });
      if (route.status === 'DRAFT' || route.status === 'PLANNED') await tx.route.update({ where: { id: route.id }, data: { status: 'IN_PROGRESS' } });
      return visit;
    });
    await markFieldWorked(this.prisma, actor.id, new Date());
    await this.recordAudit(actor, 'ROUTE_VISIT_START', stopId, { distanceMeters, gpsVerified, gpsAccuracyMeters: dto.accuracy ?? null, weakGps, mimeType: file.mimetype }, ipAddress);
    return activity;
  }

  async visitPhoto(actor: SessionUser, stopId: string, kind: 'in' | 'out' = 'in') {
    this.ensureAccess(actor);
    const stop = await this.prisma.routeStop.findFirst({
      where: { id: stopId, ...(this.isAdmin(actor) ? {} : { route: { staffId: actor.id } }) },
      select: { activity: { select: { visitProof: true } } },
    });
    const proof = stop?.activity?.visitProof;
    if (!proof) throw new NotFoundException('Visit photo not found.');
    if (kind === 'out') {
      if (!proof.checkOutPhoto || !proof.checkOutPhotoMime) throw new NotFoundException('Check-out photo not found.');
      return { buffer: Buffer.from(proof.checkOutPhoto), mime: proof.checkOutPhotoMime };
    }
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
    const [items, total, staff, territoryRows, completed, pending, gpsVerifiedCount, photoCaptured, productive, ordersGenerated] = await Promise.all([
      this.prisma.routeStop.findMany({ where, include: { route: { include: { staff: { select: { id: true, name: true } } } }, client: { select: { id: true, salonName: true, city: true, area: true, territory: true } }, activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true } } } } }, orderBy: { activity: { checkInAt: 'desc' } }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.routeStop.count({ where }),
      this.prisma.user.findMany({ where: { status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] } } } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.client.findMany({ where: { territory: { not: null } }, select: { territory: true }, distinct: ['territory'], orderBy: { territory: 'asc' } }),
      // The summary covers every matching visit, not only the page being shown.
      this.prisma.routeStop.count({ where: { AND: [where, { status: 'VISITED' }] } }),
      this.prisma.routeStop.count({ where: { AND: [where, { status: 'PLANNED' }] } }),
      this.prisma.routeStop.count({ where: { AND: [where, { activity: { visitProof: { gpsVerified: true } } }] } }),
      this.prisma.routeStop.count({ where: { AND: [where, { activity: { visitProof: { isNot: null } } }] } }),
      this.prisma.routeStop.count({ where: { AND: [where, { activity: { visitOutcome: 'PRODUCTIVE' } }] } }),
      this.prisma.routeStop.count({ where: { AND: [where, { activity: { visitOutcome: 'ORDER_GENERATED' } }] } }),
    ]);
    return {
      summary: { total, completed, pending, gpsVerified: gpsVerifiedCount, photoCaptured, productive, ordersGenerated },
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.page * query.pageSize < total,
      items,
      filters: { staff, territories: territoryRows.map((row) => row.territory).filter(Boolean) },
    };
  }

  async visitEvidence(actor: SessionUser, stopId: string) {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Field activity evidence is restricted to Super Admin.');
    const stop = await this.prisma.routeStop.findUnique({
      where: { id: stopId },
      include: { route: { include: { staff: { select: { id: true, name: true } } } }, client: true, activity: { include: { visitProof: { select: { distanceMeters: true, gpsVerified: true, capturedAt: true, checkInLatitude: true, checkInLongitude: true, checkInPhotoMime: true, checkOutDistanceMeters: true, checkOutGpsVerified: true, checkedOutAt: true, checkOutLatitude: true, checkOutLongitude: true, checkOutPhotoMime: true } } } } },
    });
    if (!stop?.activity) throw new NotFoundException('Visit evidence not found.');
    return stop;
  }

  // Check-out records only the time: no photo and no GPS, so leaving a salon is a single tap.
  async completeVisit(actor: SessionUser, dateStr: string, stopId: string, dto: CompleteVisitDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    if (!route) throw new NotFoundException('Route not found.');
    const stop = route.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');

    if (!stop.activity?.visitProof) throw new BadRequestException('Check in at the salon before checking out.');
    if (stop.activity.status === 'COMPLETED') throw new BadRequestException('You have already checked out of this visit.');
    const activity = stop.activity;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.visitProof.update({ where: { activityId: activity.id }, data: { checkedOutAt: now } });
      return tx.clientActivity.update({
        where: { id: activity.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          checkOutAt: now,
          visitOutcome: dto.outcome ?? activity.visitOutcome,
          personMet: dto.personMet?.trim() || activity.personMet,
          purpose: dto.purpose?.trim() || activity.purpose,
          note: dto.note?.trim() || activity.note,
          sampleGiven: dto.sampleGiven === 'true' ? true : dto.sampleGiven === 'false' ? false : activity.sampleGiven,
          nextAction: dto.nextAction?.trim() || null,
        },
      });
    });
    await this.prisma.routeStop.update({ where: { id: stopId }, data: { status: 'VISITED' } });
    await this.recomputeRouteStatus(route.id);
    await markFieldWorked(this.prisma, actor.id, now);
    await this.recordAudit(actor, 'ROUTE_VISIT_COMPLETE', stopId, { outcome: dto.outcome ?? null }, ipAddress);
    return updated;
  }

  // One-time fallback for salons that have no saved location: the staff member stands at the salon and saves it.
  // Once saved it is locked; only an administrator can change it (same rule as the client profile).
  // The salesperson stands at a salon that was typed into the route and fills its profile. The phone's GPS becomes the salon's location,
  // and from now on the salon is a normal client: it appears in the client list and the visit can be checked in.
  async completeSalonProfile(actor: SessionUser, dateStr: string, stopId: string, dto: CompleteSalonProfileDto, ipAddress?: string) {
    this.ensureAccess(actor);
    if (actor.portal !== 'STAFF') throw new ForbiddenException('The profile is filled by the salesperson at the salon.');
    await this.dayRules.assertCanStart(actor.id);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    const stop = route?.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (!stop.client.profileIncomplete) throw new BadRequestException('This salon’s profile is already filled.');
    this.checkAccuracy(dto.accuracy);
    const client = await this.prisma.client.update({
      where: { id: stop.clientId },
      data: { salonName: dto.salonName, category: dto.category, ownerName: dto.ownerName, primaryContact: dto.primaryContact, fullAddress: dto.fullAddress, city: dto.city, area: dto.area || null, latitude: dto.latitude, longitude: dto.longitude, locationSetAt: new Date(), locationSetById: actor.id, status: 'ACTIVE', profileIncomplete: false, version: { increment: 1 } },
      select: { id: true, salonName: true, city: true, area: true, primaryContact: true, potential: true, latitude: true, longitude: true, status: true, profileIncomplete: true },
    });
    await this.recordAudit(actor, 'ROUTE_SALON_PROFILE_COMPLETED', stopId, { clientId: stop.clientId, salonName: dto.salonName, latitude: dto.latitude, longitude: dto.longitude }, ipAddress);
    return client;
  }

  async setSalonLocation(actor: SessionUser, dateStr: string, stopId: string, dto: SalonLocationDto, ipAddress?: string) {
    this.ensureAccess(actor);
    const { route } = await this.findOwnedRoute(actor, dateStr);
    const stop = route?.stops.find((item) => item.id === stopId);
    if (!stop) throw new NotFoundException('Route stop not found.');
    if (stop.client.latitude != null && stop.client.longitude != null) throw new BadRequestException('This salon already has a saved location. Ask an administrator if it needs to change.');
    this.checkAccuracy(dto.accuracy);
    await this.prisma.client.update({ where: { id: stop.clientId }, data: { latitude: dto.latitude, longitude: dto.longitude, locationSetAt: new Date(), locationSetById: actor.id } });
    await this.recordAudit(actor, 'ROUTE_SALON_LOCATION_SET', stopId, { clientId: stop.clientId, latitude: dto.latitude, longitude: dto.longitude }, ipAddress);
    return { latitude: dto.latitude, longitude: dto.longitude };
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
