import { describe, expect, it, vi } from 'vitest';
import { LeaveService } from './leave.service.js';

const staff = { id: 'u1', name: 'Ali', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const admin = { id: 'admin-1', name: 'Admin', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

// Oct 2026: Sun 4th is a weekly off (setting [0]); 5th Mon, 30th Fri, 31st Sat, Nov 1st Sun.
function build({ approved = [] as Array<{ breakdown: unknown }>, holidays = [] as string[], pendingRow = null as unknown, overlap = null as unknown } = {}) {
  const prisma = {
    operationsSettings: { findUnique: vi.fn().mockResolvedValue({ weeklyOffDays: [0] }) },
    holiday: { findMany: vi.fn().mockResolvedValue(holidays.map((date) => ({ date: day(date) }))) },
    leaveRequest: {
      findMany: vi.fn().mockResolvedValue(approved),
      findFirst: vi.fn().mockResolvedValue(overlap),
      findUnique: vi.fn().mockResolvedValue(pendingRow),
      create: vi.fn().mockImplementation(async ({ data }) => ({ id: 'l1', status: 'PENDING', reviewNote: null, reviewedAt: null, createdAt: new Date(), breakdown: null, paidDays: 0, unpaidDays: 0, reviewedBy: null, ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => ({ id: 'l1', userId: 'u1', startDate: day('2026-10-05'), endDate: day('2026-10-07'), reason: 'r', reviewNote: null, reviewedAt: new Date(), createdAt: new Date(), user: { id: 'u1', name: 'Ali' }, reviewedBy: { name: 'Admin' }, totalDays: 0, paidDays: 0, unpaidDays: 0, breakdown: null, ...data })),
    },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  return { service: new LeaveService(prisma as never), prisma };
}

describe('LeaveService paid leave policy', () => {
  it('gives the first working day of a month as paid and the rest unpaid', async () => {
    const result = await build().service.preview(staff, { startDate: '2026-10-05', endDate: '2026-10-07' });
    expect(result).toMatchObject({ totalDays: 3, paidDays: 1, unpaidDays: 2 });
  });

  it('does not count weekly offs or holidays as leave', async () => {
    expect(await build().service.preview(staff, { startDate: '2026-10-04', endDate: '2026-10-05' })).toMatchObject({ totalDays: 1, paidDays: 1, unpaidDays: 0 });
    expect(await build({ holidays: ['2026-10-06'] }).service.preview(staff, { startDate: '2026-10-05', endDate: '2026-10-07' })).toMatchObject({ totalDays: 2 });
  });

  it('makes everything unpaid once the month’s paid leave is already used', async () => {
    const used = [{ breakdown: [{ month: '2026-10', days: 1, paid: 1, unpaid: 0 }] }];
    expect(await build({ approved: used }).service.preview(staff, { startDate: '2026-10-05', endDate: '2026-10-06' })).toMatchObject({ totalDays: 2, paidDays: 0, unpaidDays: 2 });
  });

  it('gives each month its own paid leave when a request crosses months', async () => {
    const result = await build().service.preview(staff, { startDate: '2026-10-30', endDate: '2026-11-03' });
    expect(result.months).toEqual([{ month: '2026-10', days: 2, paid: 1, unpaid: 1 }, { month: '2026-11', days: 2, paid: 1, unpaid: 1 }]);
    expect(result).toMatchObject({ totalDays: 4, paidDays: 2, unpaidDays: 2 });
  });
});

describe('LeaveService requests and approval', () => {
  it('rejects overlapping requests, weekly-off-only requests and reversed dates', async () => {
    await expect(build({ overlap: { id: 'x' } }).service.create(staff, { startDate: '2099-01-05', endDate: '2099-01-06', reason: 'Family function' }, undefined)).rejects.toThrow('already have');
    await expect(build().service.create(staff, { startDate: '2099-01-04', endDate: '2099-01-04', reason: 'Family function' })).rejects.toThrow('weekly offs');
    await expect(build().service.create(staff, { startDate: '2099-01-06', endDate: '2099-01-05', reason: 'Family function' })).rejects.toThrow('End date');
  });

  it('refuses leave for the admin portal and dates far in the past', async () => {
    await expect(build().service.create(admin, { startDate: '2099-01-05', endDate: '2099-01-05', reason: 'x y z' })).rejects.toThrow('staff portal');
    await expect(build().service.create(staff, { startDate: '2020-01-06', endDate: '2020-01-06', reason: 'Family function' })).rejects.toThrow('within the last');
  });

  it('fixes the paid/unpaid split at approval and saves it', async () => {
    const pending = { id: 'l1', userId: 'u1', status: 'PENDING', startDate: day('2026-10-05'), endDate: day('2026-10-07'), user: { id: 'u1', name: 'Ali', managerId: null } };
    const { service, prisma } = build({ pendingRow: pending });
    const result = await service.review(admin, 'l1', { status: 'APPROVED' });
    expect(prisma.leaveRequest.update.mock.calls[0]![0].data).toMatchObject({ status: 'APPROVED', totalDays: 3, paidDays: 1, unpaidDays: 2 });
    expect(result).toMatchObject({ status: 'APPROVED', paidDays: 1, unpaidDays: 2 });
  });

  it('stores no split on rejection, blocks double review and other managers’ teams', async () => {
    const pending = { id: 'l1', userId: 'u1', status: 'PENDING', startDate: day('2026-10-05'), endDate: day('2026-10-07'), user: { id: 'u1', name: 'Ali', managerId: 'm1' } };
    const rejected = build({ pendingRow: pending });
    await rejected.service.review(admin, 'l1', { status: 'REJECTED', reviewNote: 'Busy week' });
    expect(rejected.prisma.leaveRequest.update.mock.calls[0]![0].data).not.toHaveProperty('paidDays');
    await expect(build({ pendingRow: { ...pending, status: 'APPROVED' } }).service.review(admin, 'l1', { status: 'APPROVED' })).rejects.toThrow('already been reviewed');
    const otherManager = { id: 'm2', name: 'M', portal: 'STAFF', roles: [{ key: 'SALES_MANAGER' }] } as never;
    await expect(build({ pendingRow: pending }).service.review(otherManager, 'l1', { status: 'APPROVED' })).rejects.toThrow('own team');
    await expect(build({ pendingRow: pending }).service.review(staff, 'l1', { status: 'APPROVED' })).rejects.toThrow('restricted');
  });
});
