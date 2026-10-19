import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { fakeJpeg } from '../captures/jpeg.testkit.js';
import { RoutesService } from './routes.service.js';

const actor = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
const photo = { buffer: fakeJpeg({ tag: 1 }), mimetype: 'image/jpeg', size: 1000 };
const captureToken = 'a'.repeat(48);
// The salon is saved at this point; "near" is a few metres away, "far" is about 12 km away.
const salon = { id: 'client-1', salonName: 'Glow Studio', latitude: 22.3072, longitude: 73.1812 };
const near = { latitude: 22.30725, longitude: 73.18125, captureToken };
const far = { latitude: 22.4, longitude: 73.3, captureToken };

function build({ client = salon as Record<string, unknown>, activity = null as unknown, routeDate = today } = {}) {
  const prisma = {
    route: {
      findUnique: vi.fn().mockResolvedValue({ id: 'route-1', staffId: 'staff-1', routeDate: new Date(`${routeDate}T00:00:00Z`), status: 'PLANNED', stops: [{ id: 'stop-1', clientId: 'client-1', status: 'PLANNED', client, activity }] }),
      update: vi.fn(),
    },
    routeStop: { update: vi.fn(), findMany: vi.fn().mockResolvedValue([{ status: 'VISITED' }]) },
    operationsSettings: { findUnique: vi.fn().mockResolvedValue({ visitRadiusMeters: 100 }) },
    clientActivity: { create: vi.fn().mockResolvedValue({ id: 'activity-1' }), update: vi.fn().mockResolvedValue({ id: 'activity-1' }) },
    visitProof: { upsert: vi.fn(), update: vi.fn(), findFirst: vi.fn().mockResolvedValue(null) },
    client: { update: vi.fn() },
    attendanceRecord: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const captures = { consume: vi.fn().mockResolvedValue(undefined) };
  return { service: new RoutesService(prisma as unknown as PrismaService, captures as never, { assertCanStart: vi.fn() } as never), prisma, captures };
}

describe('RoutesService strict salon check-in', () => {
  it('refuses a check-in that is not within the salon radius', async () => {
    const { service, prisma, captures } = build();
    await expect(service.startVisit(actor, today, 'stop-1', far, photo)).rejects.toThrow(/from Glow Studio.*within 100 m/);
    expect(prisma.visitProof.upsert).not.toHaveBeenCalled();
    expect(captures.consume).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });

  it('refuses when the salon has no saved location, a weak GPS signal, or the wrong day', async () => {
    await expect(build({ client: { ...salon, latitude: null, longitude: null } }).service.startVisit(actor, today, 'stop-1', near, photo)).rejects.toThrow('no saved location');
    await expect(build().service.startVisit(actor, today, 'stop-1', { ...near, accuracy: 180 } as never, photo)).rejects.toThrow('GPS signal is too weak');
    await expect(build({ routeDate: '2026-01-05' }).service.startVisit(actor, '2026-01-05', 'stop-1', near, photo)).rejects.toThrow('only on the day of the route');
  });

  it('accepts a check-in at the salon, stores the verified proof and opens today’s attendance', async () => {
    const { service, prisma, captures } = build();
    await service.startVisit(actor, today, 'stop-1', { ...near, accuracy: 20 } as never, photo);
    expect(prisma.visitProof.upsert.mock.calls[0]![0].create).toMatchObject({ gpsVerified: true, checkInLatitude: near.latitude, checkInPhotoHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(captures.consume).toHaveBeenCalledWith('staff-1', captureToken, 'VISIT_CHECK_IN', 'stop-1');
    expect(prisma.visitProof.upsert.mock.calls[0]![0].create.distanceMeters).toBeLessThanOrEqual(100);
    expect(prisma.attendanceRecord.upsert.mock.calls[0]![0].create).toMatchObject({ userId: 'staff-1', fromVisits: true });
  });
});

describe('RoutesService check-out and attendance', () => {
  it('cannot check out before checking in', async () => {
    const { service } = build({ activity: { id: 'activity-1', visitProof: null } });
    await expect(service.completeVisit(actor, today, 'stop-1', {} as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks out with the time only (no photo or GPS) and extends the attendance day', async () => {
    const checkIn = new Date(Date.now() - 3 * 3600_000);
    const { service, prisma } = build({ activity: { id: 'activity-1', status: 'OPEN', visitOutcome: null, visitProof: { gpsVerified: true } } });
    prisma.attendanceRecord.findUnique.mockResolvedValue({ punchInAt: checkIn, punchOutAt: checkIn, fromVisits: true });
    await service.completeVisit(actor, today, 'stop-1', {} as never);
    expect(prisma.visitProof.update.mock.calls[0]![0].data).toEqual({ checkedOutAt: expect.any(Date) });
    expect(prisma.clientActivity.update.mock.calls[0]![0].data).toMatchObject({ status: 'COMPLETED', checkOutAt: expect.any(Date) });
    const attendance = prisma.attendanceRecord.upsert.mock.calls[0]![0].update;
    expect(attendance.punchInAt).toEqual(checkIn);
    expect(attendance.punchOutAt.getTime()).toBeGreaterThan(checkIn.getTime());
  });

  it('lets staff save a missing salon location once, and never overwrite a saved one', async () => {
    const missing = build({ client: { ...salon, latitude: null, longitude: null } });
    await missing.service.setSalonLocation(actor, today, 'stop-1', near);
    expect(missing.prisma.client.update.mock.calls[0]![0].data).toMatchObject({ latitude: near.latitude, longitude: near.longitude, locationSetById: 'staff-1' });
    await expect(build().service.setSalonLocation(actor, today, 'stop-1', near)).rejects.toThrow('already has a saved location');
  });
});

describe('RoutesService live camera guard on check-in', () => {
  it('refuses a gallery-style photo before using the camera pass', async () => {
    const { service, prisma, captures } = build();
    await expect(service.startVisit(actor, today, 'stop-1', near, { ...photo, buffer: fakeJpeg({ exif: true }) })).rejects.toThrow('in-app camera');
    await expect(service.startVisit(actor, today, 'stop-1', near, { ...photo, buffer: fakeJpeg({ width: 4032, height: 3024 }) })).rejects.toThrow('in-app camera');
    expect(captures.consume).not.toHaveBeenCalled();
    expect(prisma.visitProof.upsert).not.toHaveBeenCalled();
  });

  it('refuses a photo that was already used for another visit', async () => {
    const { service, prisma, captures } = build();
    prisma.visitProof.findFirst.mockResolvedValue({ id: 'earlier-proof' });
    await expect(service.startVisit(actor, today, 'stop-1', near, photo)).rejects.toThrow('already been used');
    expect(captures.consume).not.toHaveBeenCalled();
  });

  it('saves nothing when the camera pass is missing, expired or used', async () => {
    const { service, prisma, captures } = build();
    captures.consume.mockRejectedValue(new BadRequestException('This photo was not taken with the in-app camera'));
    await expect(service.startVisit(actor, today, 'stop-1', near, photo)).rejects.toThrow('in-app camera');
    expect(prisma.visitProof.upsert).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.upsert).not.toHaveBeenCalled();
  });
});

describe('RoutesService admin visits paging', () => {
  it('pages the visit list but summarises every matching visit', async () => {
    const { service, prisma } = build();
    const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
    Object.assign(prisma, {
      routeStop: { ...prisma.routeStop, findMany: vi.fn().mockResolvedValue([{ id: 's1' }]), count: vi.fn().mockResolvedValueOnce(95).mockResolvedValue(10) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      client: { ...prisma.client, findMany: vi.fn().mockResolvedValue([]) },
    });
    const result = await service.adminVisits(admin, { page: 3, pageSize: 20 } as never);
    expect(prisma.routeStop.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
    expect(result.summary.total).toBe(95);
    expect(result).toMatchObject({ page: 3, pageSize: 20, hasMore: true });
    expect(result.summary).toMatchObject({ completed: 10, pending: 10, gpsVerified: 10 });
  });
});

describe('RoutesService salons added by name', () => {
  const dto = { name: '  Royal   Hair Studio ', city: ' surat ' } as never;
  const saved = { id: 'c-new', salonName: 'Royal Hair Studio', city: 'surat', area: null, potential: null, beat: null };

  it('saves a salon typed by name as a prospect client assigned to the salesperson', async () => {
    const { service, prisma } = build();
    Object.assign(prisma, { client: { ...prisma.client, findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue(saved) } });
    const result = await service.addSalonByName(actor, dto);
    expect(prisma.client.create.mock.calls[0]![0].data).toMatchObject({ salonName: 'Royal Hair Studio', city: 'surat', status: 'PROSPECT', primaryContact: '', assignedSalespersonId: 'staff-1', createdById: 'staff-1' });
    expect(result).toMatchObject({ id: 'c-new', existing: false });
  });

  it('reuses the salon the salesperson already has, ignoring case and spacing', async () => {
    const { service, prisma } = build();
    Object.assign(prisma, { client: { ...prisma.client, findMany: vi.fn().mockResolvedValue([{ ...saved, id: 'c-old', salonName: 'royal hair studio', city: 'Surat' }]), create: vi.fn() } });
    const result = await service.addSalonByName(actor, dto);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'c-old', existing: true });
  });

  it('is for the salesperson only', async () => {
    const { service } = build();
    await expect(service.addSalonByName({ id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never, dto)).rejects.toThrow();
  });
});

describe('RoutesService profile filled at the salon', () => {
  const unfilled = { ...salon, latitude: null, longitude: null, city: 'Surat', profileIncomplete: true };
  const profile = { salonName: 'Royal Hair Studio', category: 'SALON', ownerName: 'Meena Shah', primaryContact: '9876543210', fullAddress: '12 Ring Road, Surat', city: 'Surat', area: 'Adajan', latitude: 21.19, longitude: 72.79, accuracy: 20 } as never;

  it('fills the profile from the salon, saves the phone’s GPS as its location and makes it a normal client', async () => {
    const { service, prisma } = build({ client: unfilled });
    prisma.client.update.mockResolvedValue({ id: 'client-1', salonName: 'Royal Hair Studio', profileIncomplete: false });
    await service.completeSalonProfile(actor, today, 'stop-1', profile);
    expect(prisma.client.update.mock.calls[0]![0].data).toMatchObject({ salonName: 'Royal Hair Studio', ownerName: 'Meena Shah', primaryContact: '9876543210', latitude: 21.19, longitude: 72.79, status: 'ACTIVE', profileIncomplete: false, locationSetById: 'staff-1' });
  });

  it('refuses a salon whose profile is already filled, or a weak GPS signal', async () => {
    const filled = build();
    await expect(filled.service.completeSalonProfile(actor, today, 'stop-1', profile)).rejects.toThrow('already filled');
    const weak = build({ client: unfilled });
    await expect(weak.service.completeSalonProfile(actor, today, 'stop-1', { ...(profile as object), accuracy: 400 } as never)).rejects.toThrow('GPS signal is too weak');
    expect(weak.prisma.client.update).not.toHaveBeenCalled();
  });

  it('does not let anyone check in at a salon until its profile has been filled', async () => {
    const { service, prisma, captures } = build({ client: unfilled });
    await expect(service.startVisit(actor, today, 'stop-1', near, photo)).rejects.toThrow('client profile first');
    expect(prisma.visitProof.upsert).not.toHaveBeenCalled();
    expect(captures.consume).not.toHaveBeenCalled();
  });
});
