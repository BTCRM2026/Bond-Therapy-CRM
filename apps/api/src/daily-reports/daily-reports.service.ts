import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CapturesService } from '../captures/captures.service.js';
import { assertLiveCameraPhoto } from '../captures/live-photo.js';
import { recordAudit } from '../common/audit.util.js';
import type { SessionUser } from '../common/session.util.js';
import { DayRulesService } from '../day-rules/day-rules.service.js';
import { FULL_DAY_CALLS, HALF_DAY_CALLS, reportCutoff } from '../day-rules/day-rules.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { needsNoOrderReason, summarizeDailyCalls } from './daily-reports.logic.js';
import type { SaveDailyReportDto } from './dto.js';

const salesRoles = new Set(['SALES_MANAGER', 'SALES_EXECUTIVE']);
const standardTowns = ['Navsari', 'Surat', 'Vadodara', 'Ahmedabad', 'Bhavnagar', 'Junagadh', 'Rajkot', 'Gandhinagar', 'Jaipur', 'Indore'];
const reportInclude = {
  calls: { orderBy: { sequence: 'asc' }, select: { id: true, sequence: true, visitActivityId: true, customerName: true, customerType: true, result: true, orderValue: true, remark: true, photoMime: true, photoCapturedAt: true, createdAt: true } },
  coworker: { select: { id: true, name: true } },
  tomorrowRoute: { include: { stops: { where: { status: { not: 'REMOVED' } }, orderBy: { sequence: 'asc' }, include: { client: { select: { id: true, salonName: true, city: true, area: true } } } } } },
} satisfies Prisma.DailySalesReportInclude;

@Injectable()
export class DailyReportsService {
  constructor(private readonly prisma: PrismaService, private readonly captures: CapturesService, private readonly dayRules: DayRulesService) {}

  private ensureAccess(actor: SessionUser) {
    if (actor.portal !== 'STAFF' || !actor.roles.some((role) => salesRoles.has(role.key))) throw new ForbiddenException('Daily reports are available only to the sales team.');
  }

  private dateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  private dateFromKey(value: string) { return new Date(`${value}T00:00:00.000Z`); }

  private tomorrow(date: Date) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  private assignedClientWhere(staffId: string): Prisma.ClientWhereInput {
    return {
      status: { not: 'INACTIVE' },
      OR: [
        { assignedSalespersonId: staffId },
        { beat: { territory: { assignments: { some: { userId: staffId, endDate: null } } } } },
      ],
    };
  }

  private serialize(report: Prisma.DailySalesReportGetPayload<{ include: typeof reportInclude }> | null) {
    if (!report) return null;
    return {
      ...report,
      calls: report.calls.map((call) => ({ ...call, orderValue: call.orderValue == null ? null : Number(call.orderValue) })),
      tomorrowClients: report.tomorrowRoute?.stops.map((stop) => stop.client) ?? [],
      summary: summarizeDailyCalls(report.calls.map((call) => ({ customerType: call.customerType, result: call.result, orderValue: call.orderValue == null ? null : Number(call.orderValue) }))),
    };
  }

  private async context(actor: SessionUser) {
    const assignedWhere = this.assignedClientWhere(actor.id);
    const [profile, clients, assignments, coworkers] = await Promise.all([
      this.prisma.staffProfile.findUnique({ where: { userId: actor.id }, select: { workLocation: true } }),
      this.prisma.client.findMany({ where: assignedWhere, select: { id: true, salonName: true, city: true, area: true, profileIncomplete: true }, orderBy: [{ city: 'asc' }, { salonName: 'asc' }] }),
      this.prisma.territoryAssignment.findMany({ where: { userId: actor.id, endDate: null, territory: { isActive: true } }, select: { territory: { select: { city: { select: { name: true } } } } } }),
      this.prisma.user.findMany({ where: { id: { not: actor.id }, status: 'ACTIVE', roles: { some: { role: { key: { in: [...salesRoles] }, portal: 'STAFF', isActive: true } } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    const territoryTowns = assignments.map((item) => item.territory.city.name);
    const towns = [...new Set([...standardTowns, profile?.workLocation, ...territoryTowns, ...clients.map((client) => client.city)].filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim()))].sort((a, b) => a.localeCompare(b));
    return { headquarter: profile?.workLocation?.trim() || territoryTowns[0] || null, towns, clients, coworkers };
  }

  // Salon visits checked in today with a GPS-verified arrival; the report is filled from these.
  private async todayVisits(actor: SessionUser, date: Date) {
    const rows = await this.prisma.clientActivity.findMany({
      where: { type: 'VISIT', createdById: actor.id, checkInAt: { not: null }, routeStop: { is: { route: { staffId: actor.id, routeDate: date } } }, visitProof: { is: { gpsVerified: true } } },
      select: { id: true, clientId: true, checkInAt: true, checkOutAt: true, client: { select: { salonName: true, city: true } }, routeStop: { select: { id: true } }, visitProof: { select: { distanceMeters: true } } },
      orderBy: { checkInAt: 'asc' },
    });
    return rows.map((row) => ({ activityId: row.id, stopId: row.routeStop?.id ?? null, clientId: row.clientId, salonName: row.client.salonName, city: row.client.city, checkInAt: row.checkInAt, checkOutAt: row.checkOutAt, distanceMeters: row.visitProof?.distanceMeters ?? null }));
  }

  async today(actor: SessionUser) {
    this.ensureAccess(actor);
    const date = this.dateFromKey(this.dateKey());
    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    const [context, report, recent, monthNewCalls, callTarget] = await Promise.all([
      this.context(actor),
      this.prisma.dailySalesReport.findUnique({ where: { staffId_reportDate: { staffId: actor.id, reportDate: date } }, include: reportInclude }),
      this.prisma.dailySalesReport.findMany({ where: { staffId: actor.id }, include: reportInclude, orderBy: { reportDate: 'desc' }, take: 5 }),
      this.prisma.dailySalesCall.count({ where: { customerType: 'NEW', report: { staffId: actor.id, reportDate: { gte: monthStart, lt: monthEnd } } } }),
      this.prisma.target.findFirst({ where: { scope: 'STAFF', scopeId: actor.id, metric: 'CALLS', period: 'MONTHLY', periodYear: date.getUTCFullYear(), periodIndex: date.getUTCMonth() + 1 }, select: { targetValue: true } }),
    ]);
    const visits = await this.todayVisits(actor, date);
    const [gate, strictFrom] = await Promise.all([this.dayRules.gate(actor.id), this.dayRules.strictFrom()]);
    return {
      date: this.dateKey(),
      visits,
      // Rules shown on the report screen: the report locks once submitted, and 11 PM is the deadline for a full day.
      rules: { fullDayCalls: FULL_DAY_CALLS, halfDayCalls: HALF_DAY_CALLS, deadlineAt: reportCutoff(this.dateKey()).toISOString(), locked: Boolean(report), startsOn: strictFrom ? strictFrom.toISOString().slice(0, 10) : null },
      gate,
      staff: { id: actor.id, name: actor.name, headquarter: context.headquarter },
      towns: context.towns,
      clients: context.clients,
      coworkers: context.coworkers,
      report: this.serialize(report),
      recent: recent.map((item) => this.serialize(item)),
      performance: { monthNewCalls, monthlyTarget: callTarget ? Number(callTarget.targetValue) : null },
    };
  }

  async save(actor: SessionUser, dto: SaveDailyReportDto, photos: Array<{ fieldname: string; buffer: Buffer; mimetype: string; size: number }>, ipAddress?: string) {
    this.ensureAccess(actor);
    const reportDate = this.dateFromKey(this.dateKey());
    // The report is the end of the day: once it is submitted the day is locked.
    if (await this.prisma.dailySalesReport.findUnique({ where: { staffId_reportDate: { staffId: actor.id, reportDate } }, select: { id: true } })) throw new ConflictException('Today’s report is already submitted and locked. Ask your administrator if something needs to change.');
    // Until the strict day rules start, a report may have no calls (for example on launch night), so tomorrow's route can still be planned.
    const strictFrom = await this.dayRules.strictFrom();
    if (!dto.calls.length && strictFrom && reportDate.getTime() >= strictFrom.getTime()) throw new BadRequestException('You have no verified visits today. Check in at a salon from My Route first, or add a call.');
    const context = await this.context(actor);
    if (!context.towns.includes(dto.workingTown) || !context.towns.includes(dto.tomorrowTown)) throw new BadRequestException('Select a town assigned to your territory.');
    if (dto.coworkerId && !context.coworkers.some((coworker) => coworker.id === dto.coworkerId)) throw new BadRequestException('Select an active sales coworker or Solo.');

    const clientIds = [...new Set(dto.tomorrowClientIds)];
    // Temporary: salons without a client profile can be planned by name until every salon has one.
    const seenSalons = new Set<string>();
    const newSalons = (dto.tomorrowNewSalons ?? []).map((name) => name.trim()).filter((name) => name && !seenSalons.has(name.toLowerCase()) && seenSalons.add(name.toLowerCase()));
    if (!clientIds.length && !newSalons.length) throw new BadRequestException('Add at least one salon to tomorrow’s plan.');
    const selectedClients = context.clients.filter((client) => clientIds.includes(client.id));
    if (selectedClients.length !== clientIds.length) throw new BadRequestException('Tomorrow’s plan can include only clients assigned to you.');
    if (selectedClients.some((client) => client.city !== dto.tomorrowTown)) throw new BadRequestException('Every selected client must belong to tomorrow’s town.');

    const hasOrder = dto.calls.some((call) => call.result === 'ORDER');
    for (const photo of photos) {
      if (!/^photo-\d+$/.test(photo.fieldname)) throw new BadRequestException('A call photo could not be matched to its call.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimetype)) throw new BadRequestException('Call photos must be JPG, PNG, or WebP.');
      if (photo.size > 2 * 1024 * 1024) throw new BadRequestException('Each call photo must be 2 MB or smaller. Retake the photo and try again.');
    }
    // Newly taken photos must come from the in-app camera and must be new: each is fingerprinted, never reused across calls or visits.
    const hashes = new Map<number, string>();
    for (const photo of photos) {
      const index = Number(photo.fieldname.slice('photo-'.length));
      if (index >= dto.calls.length) throw new BadRequestException('A call photo could not be matched to its call.');
      hashes.set(index, assertLiveCameraPhoto(photo.buffer));
    }
    const fingerprints = [...hashes.values()];
    if (new Set(fingerprints).size !== fingerprints.length) throw new BadRequestException('The same photo was used for more than one call. Take a separate photo for each call.');
    if (fingerprints.length) {
      const reused = (await this.prisma.dailySalesCall.findFirst({ where: { photoHash: { in: fingerprints } }, select: { id: true } })) ?? (await this.prisma.visitProof.findFirst({ where: { checkInPhotoHash: { in: fingerprints } }, select: { id: true } }));
      if (reused) throw new BadRequestException('One of these photos has already been used. Take a new photo for each call.');
    }
    if (dto.calls.length && needsNoOrderReason(dto.calls, dto.noOrderReason)) throw new BadRequestException('Add a reason when no order was received today.');
    for (const call of dto.calls) {
      if (call.result === 'ORDER' && (!call.orderValue || call.orderValue <= 0)) throw new BadRequestException(`Enter the order value for ${call.customerName}.`);
    }

    const routeDate = this.tomorrow(reportDate);
    const visitIds = dto.calls.map((call) => call.visitActivityId).filter((id): id is string => Boolean(id));
    if (new Set(visitIds).size !== visitIds.length) throw new BadRequestException('A salon visit can appear only once in the report.');
    // Every verified visit of the day must be closed and included before the day can be submitted.
    const todays = await this.todayVisits(actor, reportDate);
    const stillOpen = todays.filter((visit) => !visit.checkOutAt);
    if (stillOpen.length) throw new BadRequestException(`Check out of ${stillOpen.map((visit) => visit.salonName).join(', ')} before submitting your report.`);
    const left = todays.filter((visit) => !visitIds.includes(visit.activityId));
    if (left.length) throw new BadRequestException(`Add ${left.map((visit) => visit.salonName).join(', ')} to your report: every salon you visited today must be included.`);
    const visits = visitIds.length ? await this.prisma.clientActivity.findMany({
      where: { id: { in: visitIds }, type: 'VISIT', createdById: actor.id, routeStop: { is: { route: { staffId: actor.id, routeDate: reportDate } } }, visitProof: { is: { gpsVerified: true } } },
      select: { id: true, client: { select: { salonName: true } }, visitProof: { select: { checkInPhoto: true, checkInPhotoMime: true, checkInPhotoHash: true } } },
    }) : [];
    if (visits.length !== visitIds.length) throw new BadRequestException('One of the salon visits in your report could not be verified. Reload the page and try again.');
    const existingIds = dto.calls.map((call) => call.existingCallId).filter((id): id is string => Boolean(id));
    const existingPhotos = existingIds.length ? await this.prisma.dailySalesCall.findMany({ where: { id: { in: existingIds }, report: { staffId: actor.id, reportDate } }, select: { id: true, visitPhoto: true, photoMime: true, photoHash: true } }) : [];
    const photoData = dto.calls.map((call, index) => {
      const visit = visits.find((item) => item.id === call.visitActivityId);
      if (visit?.visitProof) return { visitPhoto: visit.visitProof.checkInPhoto, photoMime: visit.visitProof.checkInPhotoMime, photoHash: visit.visitProof.checkInPhotoHash };
      const upload = photos.find((photo) => photo.fieldname === `photo-${index}`);
      if (upload) return { visitPhoto: upload.buffer, photoMime: 'image/jpeg', photoHash: hashes.get(index) ?? null };
      const existing = existingPhotos.find((photo) => photo.id === call.existingCallId);
      if (existing) return { visitPhoto: existing.visitPhoto, photoMime: existing.photoMime, photoHash: existing.photoHash };
      throw new BadRequestException(`Capture a visit photo for call ${index + 1}.`);
    });
    // Camera passes are used up last, once every other check has passed, so a rejected submit does not cost the staff member their photos.
    for (const index of hashes.keys()) await this.captures.consume(actor.id, dto.calls[index]?.captureToken, 'REPORT_CALL');
    const saved = await this.prisma.$transaction(async (tx) => {
      const existingRoute = await tx.route.findUnique({ where: { staffId_routeDate: { staffId: actor.id, routeDate } }, include: { stops: true } });
      if (existingRoute?.stops.some((stop) => !['PLANNED', 'REMOVED'].includes(stop.status))) throw new BadRequestException('Tomorrow’s route has already started and can no longer be replaced.');
      const notes = `Created from daily report ${this.dateKey()}${newSalons.length ? `. New salons without a profile yet: ${newSalons.join(', ')}` : ''}`.slice(0, 500);
      const route = existingRoute
        ? await tx.route.update({ where: { id: existingRoute.id }, data: { status: 'PLANNED', notes } })
        : await tx.route.create({ data: { staffId: actor.id, routeDate, status: 'PLANNED', notes } });
      // A salon typed by name has no client profile yet. It becomes a stop on tomorrow's route with a prospect profile that the
      // salesperson completes at the salon (saving its location there is what lets the visit be verified).
      const typedIds: string[] = [];
      for (const name of newSalons) {
        const match = context.clients.find((client) => client.city === dto.tomorrowTown && client.salonName.trim().toLowerCase() === name.toLowerCase());
        if (match) { typedIds.push(match.id); continue; }
        const created = await tx.client.create({ data: { salonName: name, category: 'SALON', primaryContact: '', city: dto.tomorrowTown, status: 'PROSPECT', profileIncomplete: true, assignedSalespersonId: actor.id, createdById: actor.id } });
        typedIds.push(created.id);
      }
      const stopClientIds = [...new Set([...clientIds, ...typedIds])];
      await tx.routeStop.deleteMany({ where: { routeId: route.id } });
      await tx.routeStop.createMany({ data: stopClientIds.map((clientId, sequence) => ({ routeId: route.id, clientId, sequence })) });
      await tx.routeChangeLog.create({ data: { routeId: route.id, changedById: actor.id, changeType: 'STATUS_CHANGE', reason: 'Tomorrow plan submitted with daily sales report', newValue: { clientIds, newSalons, town: dto.tomorrowTown } } });

      const report = await tx.dailySalesReport.upsert({
        where: { staffId_reportDate: { staffId: actor.id, reportDate } },
        create: { staffId: actor.id, reportDate, headquarter: context.headquarter, workingTown: dto.workingTown, coworkerId: dto.coworkerId || null, tomorrowTown: dto.tomorrowTown, tomorrowRouteId: route.id, tomorrowExtraStops: newSalons.length ? newSalons : Prisma.JsonNull, noOrderReason: hasOrder ? null : (dto.noOrderReason?.trim() || 'No calls recorded today') },
        update: { headquarter: context.headquarter, workingTown: dto.workingTown, coworkerId: dto.coworkerId || null, tomorrowTown: dto.tomorrowTown, tomorrowRouteId: route.id, tomorrowExtraStops: newSalons.length ? newSalons : Prisma.JsonNull, noOrderReason: hasOrder ? null : (dto.noOrderReason?.trim() || 'No calls recorded today'), submittedAt: new Date() },
      });
      await tx.dailySalesCall.deleteMany({ where: { reportId: report.id } });
      await tx.dailySalesCall.createMany({ data: dto.calls.map((call, sequence) => { const visit = visits.find((item) => item.id === call.visitActivityId); return ({ reportId: report.id, sequence, customerName: visit ? visit.client.salonName : call.customerName.trim(), customerType: visit ? 'EXISTING' as const : call.customerType, visitActivityId: visit?.id ?? null, result: call.result, orderValue: call.result === 'ORDER' ? call.orderValue : null, remark: call.remark?.trim() || null, ...photoData[sequence] }); }) });
      return tx.dailySalesReport.findUniqueOrThrow({ where: { id: report.id }, include: reportInclude });
    });
    await recordAudit(this.prisma, { actorId: actor.id, action: 'DAILY_REPORT_SUBMIT', entity: 'DAILY_SALES_REPORT', entityId: saved.id, details: { callCount: dto.calls.length, tomorrowClientCount: clientIds.length, tomorrowNewSalons: newSalons.length, visitCalls: visitIds.length, workingTown: dto.workingTown, tomorrowTown: dto.tomorrowTown }, ipAddress });
    return this.serialize(saved);
  }

  async photo(actor: SessionUser, callId: string) {
    this.ensureAccess(actor);
    const call = await this.prisma.dailySalesCall.findFirst({ where: { id: callId, report: { staffId: actor.id } }, select: { visitPhoto: true, photoMime: true } });
    if (!call) throw new BadRequestException('Call photo not found.');
    return { buffer: Buffer.from(call.visitPhoto), mime: call.photoMime };
  }
}
