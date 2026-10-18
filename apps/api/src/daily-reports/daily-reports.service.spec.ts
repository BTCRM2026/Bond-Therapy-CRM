import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { fakeJpeg } from '../captures/jpeg.testkit.js';
import { DailyReportsService } from './daily-reports.service.js';

const actor = { id: 'staff-1', name: 'Ali', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const visit = { id: 'visit-1', clientId: 'c1', checkInAt: new Date('2026-10-17T05:00:00Z'), checkOutAt: new Date('2026-10-17T05:30:00Z'), routeStop: { id: 'stop-1' }, client: { salonName: 'Glow Studio', city: 'Vadodara' }, visitProof: { distanceMeters: 8, checkInPhoto: Buffer.from('proof'), checkInPhotoMime: 'image/jpeg', checkInPhotoHash: 'f'.repeat(64) } };
const base = { workingTown: 'Vadodara', tomorrowTown: 'Surat', tomorrowClientIds: [] as string[], calls: [{ visitActivityId: 'visit-1', customerName: 'x', customerType: 'NEW', result: 'ORDER', orderValue: 5000 }] };

function build(visits: unknown[] = [visit]) {
  const prisma = {
    staffProfile: { findUnique: vi.fn().mockResolvedValue({ workLocation: 'Vadodara' }) },
    client: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockImplementation(async ({ data }: { data: { salonName: string } }) => ({ id: `client-${data.salonName}` })) },
    territoryAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    clientActivity: { findMany: vi.fn().mockResolvedValue(visits) },
    dailySalesCall: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null), deleteMany: vi.fn(), createMany: vi.fn() },
    visitProof: { findFirst: vi.fn().mockResolvedValue(null) },
    route: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'route-1' }), update: vi.fn() },
    routeStop: { deleteMany: vi.fn(), createMany: vi.fn() },
    routeChangeLog: { create: vi.fn() },
    dailySalesReport: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({ id: 'report-1' }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'report-1', calls: [], tomorrowRoute: null }) },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  const captures = { consume: vi.fn().mockResolvedValue(undefined) };
  return { service: new DailyReportsService(prisma as unknown as PrismaService, captures as never, { gate: vi.fn().mockResolvedValue({ blocked: false }), strictFrom: vi.fn().mockResolvedValue(null) } as never), prisma, captures };
}

describe('DailyReportsService visit-based reports', () => {
  it('fills a call from a GPS-verified visit: salon name and check-in photo are reused, no upload needed', async () => {
    const { service, prisma } = build();
    await service.save(actor, { ...base, tomorrowNewSalons: ['Royal Hair Studio'] } as never, []);
    const rows = prisma.dailySalesCall.createMany.mock.calls[0]![0].data;
    expect(rows[0]).toMatchObject({ customerName: 'Glow Studio', customerType: 'EXISTING', visitActivityId: 'visit-1', photoMime: 'image/jpeg', orderValue: 5000 });
    expect(Buffer.from(rows[0].visitPhoto).toString()).toBe('proof');
  });

  it('refuses a visit that is not today’s verified visit, or one used twice', async () => {
    await expect(build([]).service.save(actor, { ...base, tomorrowNewSalons: ['A Salon'] } as never, [])).rejects.toThrow('could not be verified');
    const twice = { ...base, calls: [base.calls[0], { ...base.calls[0] }], tomorrowNewSalons: ['A Salon'] };
    await expect(build().service.save(actor, twice as never, [])).rejects.toThrow('only once');
  });

  it('still needs a photo for a call that is not from a verified visit', async () => {
    const manual = { ...base, calls: [{ customerName: 'Walk-in Salon', customerType: 'NEW', result: 'NO_ORDER' }], noOrderReason: 'Owner away', tomorrowNewSalons: ['A Salon'] };
    await expect(build([]).service.save(actor, manual as never, [])).rejects.toThrow('Capture a visit photo');
  });

  it('plans tomorrow from salon names alone for now, and refuses an empty plan', async () => {
    const { service, prisma } = build();
    await service.save(actor, { ...base, tomorrowNewSalons: ['Royal Hair Studio', 'royal hair studio', ' Glam Zone '] } as never, []);
    const upsert = prisma.dailySalesReport.upsert.mock.calls[0]![0];
    expect(upsert.create.tomorrowExtraStops).toEqual(['Royal Hair Studio', 'Glam Zone']);
    expect(prisma.route.create.mock.calls[0]![0].data.notes).toContain('Royal Hair Studio, Glam Zone');
    // each typed salon becomes a prospect client and a stop on tomorrow's route
    expect(prisma.client.create).toHaveBeenCalledTimes(2);
    expect(prisma.client.create.mock.calls[0]![0].data).toMatchObject({ salonName: 'Royal Hair Studio', city: 'Surat', status: 'PROSPECT', assignedSalespersonId: 'staff-1', createdById: 'staff-1' });
    expect(prisma.routeStop.createMany.mock.calls[0]![0].data).toHaveLength(2);
    await expect(build().service.save(actor, { ...base } as never, [])).rejects.toThrow('at least one salon');
  });
});

describe('DailyReportsService day rules', () => {
  it('locks the day once a report is submitted', async () => {
    const { service, prisma } = build();
    prisma.dailySalesReport.findUnique.mockResolvedValue({ id: 'report-1' });
    await expect(service.save(actor, { ...base, tomorrowNewSalons: ['A Salon'] } as never, [])).rejects.toThrow('locked');
    expect(prisma.dailySalesReport.upsert).not.toHaveBeenCalled();
  });

  it('will not submit while a visit is still checked in, or while a visited salon is missing from the report', async () => {
    const open = build([{ ...visit, checkOutAt: null }]);
    await expect(open.service.save(actor, { ...base, tomorrowNewSalons: ['A Salon'] } as never, [])).rejects.toThrow('Check out of Glow Studio');
    const other = { ...visit, id: 'visit-2', client: { salonName: 'Royal Studio', city: 'Vadodara' } };
    await expect(build([visit, other]).service.save(actor, { ...base, tomorrowNewSalons: ['A Salon'] } as never, [])).rejects.toThrow('Add Royal Studio');
  });
});

describe('DailyReportsService empty days', () => {
  const noCalls = { workingTown: 'Vadodara', tomorrowTown: 'Surat', tomorrowClientIds: [] as string[], calls: [], tomorrowNewSalons: ['Royal Hair Studio'] };

  it('lets a day with no calls be submitted before the strict rules start, so tomorrow can be planned', async () => {
    const { service, prisma } = build([]);
    await service.save(actor, noCalls as never, []);
    expect(prisma.dailySalesReport.upsert.mock.calls[0]![0].create.noOrderReason).toBe('No calls recorded today');
    expect(prisma.routeStop.createMany.mock.calls[0]![0].data).toHaveLength(1);
  });

  it('asks for a verified visit once the strict rules have started', async () => {
    const strict = build([]);
    (strict.service as unknown as { dayRules: { strictFrom: unknown } }).dayRules.strictFrom = vi.fn().mockResolvedValue(new Date('2020-01-01T00:00:00.000Z'));
    await expect(strict.service.save(actor, noCalls as never, [])).rejects.toThrow('no verified visits');
  });
});

describe('DailyReportsService typed salons', () => {
  it('reuses a client the salesperson already has instead of creating a second one', async () => {
    const { service, prisma } = build();
    prisma.client.findMany.mockResolvedValue([{ id: 'c-glow', salonName: 'Glow Studio', city: 'Surat', area: null }]);
    await service.save(actor, { ...base, tomorrowClientIds: [], tomorrowNewSalons: ['  glow studio '] } as never, []);
    expect(prisma.client.create).not.toHaveBeenCalled();
    expect(prisma.routeStop.createMany.mock.calls[0]![0].data).toEqual([{ routeId: 'route-1', clientId: 'c-glow', sequence: 0 }]);
  });
});

describe('DailyReportsService live camera guard on call photos', () => {
  const walkIn = { ...base, calls: [{ customerName: 'Walk-in Salon', customerType: 'NEW', result: 'NO_ORDER', captureToken: 'c'.repeat(48) }], noOrderReason: 'Owner away', tomorrowNewSalons: ['A Salon'] };
  const upload = (buffer: Buffer, index = 0) => ({ fieldname: `photo-${index}`, buffer, mimetype: 'image/jpeg', size: buffer.length });

  it('accepts a live-camera photo, stores its fingerprint and uses up its camera pass', async () => {
    const { service, prisma, captures } = build([]);
    await service.save(actor, walkIn as never, [upload(fakeJpeg({ tag: 5 }))]);
    expect(prisma.dailySalesCall.createMany.mock.calls[0]![0].data[0]).toMatchObject({ photoMime: 'image/jpeg', photoHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(captures.consume).toHaveBeenCalledWith('staff-1', 'c'.repeat(48), 'REPORT_CALL');
  });

  it('refuses gallery-style photos, a reused photo, or the same photo twice, and keeps the camera pass', async () => {
    const { service, captures } = build([]);
    await expect(service.save(actor, walkIn as never, [upload(fakeJpeg({ exif: true }))])).rejects.toThrow('in-app camera');
    const reused = build([]);
    reused.prisma.dailySalesCall.findFirst.mockResolvedValue({ id: 'old-call' });
    await expect(reused.service.save(actor, walkIn as never, [upload(fakeJpeg({ tag: 6 }))])).rejects.toThrow('already been used');
    const twoCalls = { ...walkIn, calls: [walkIn.calls[0], { ...walkIn.calls[0], customerName: 'Second Salon' }] };
    await expect(build([]).service.save(actor, twoCalls as never, [upload(fakeJpeg({ tag: 7 }), 0), upload(fakeJpeg({ tag: 7 }), 1)])).rejects.toThrow('same photo');
    expect(captures.consume).not.toHaveBeenCalled();
    expect(reused.captures.consume).not.toHaveBeenCalled();
  });

  it('does not need a camera pass for a call filled from a verified visit', async () => {
    const { service, captures } = build();
    await service.save(actor, { ...base, tomorrowNewSalons: ['A Salon'] } as never, []);
    expect(captures.consume).not.toHaveBeenCalled();
  });
});
