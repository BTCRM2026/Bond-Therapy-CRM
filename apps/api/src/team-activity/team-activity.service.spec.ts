import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TeamActivityService } from './team-activity.service.js';

const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
const staffUser = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const member = (id: string, name: string) => ({ id, name, loginId: name.toLowerCase(), staffProfile: { shiftStart: null, shiftEnd: null, isTechnician: id === 's3' }, roles: [{ role: { name: 'Sales Executive', priority: 40 } }] });
const people = [member('s1', 'Asha'), member('s2', 'Bhavin'), member('s3', 'Chirag'), member('s4', 'Dev')];
const day = (status: string, isOnLeave = false) => ({ record: status === 'PRESENT' ? { punchInAt: new Date('2026-10-17T05:00:00Z'), punchOutAt: new Date('2026-10-17T12:00:00Z'), fromVisits: true } : null, isOnLeave, status, workingHours: status === 'PRESENT' ? 7 : null });

function build() {
  const attendance = { classifyStaffOnDate: vi.fn().mockResolvedValue(new Map([['s1', day('PRESENT')], ['s2', day('PRESENT')], ['s3', day('LEAVE', true)], ['s4', day('NOT_PUNCHED')]])) };
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue(people) },
    dailySalesReport: { findMany: vi.fn().mockResolvedValue([{ id: 'r1', staffId: 's1', submittedAt: new Date('2026-10-17T12:30:00Z'), calls: [{ result: 'ORDER', orderValue: 5000 }, { result: 'NO_ORDER', orderValue: null }] }]) },
    clientActivity: { groupBy: vi.fn().mockResolvedValueOnce([{ createdById: 's1', _count: { _all: 3 } }, { createdById: 's2', _count: { _all: 1 } }]).mockResolvedValueOnce([{ createdById: 's2', _count: { _all: 1 } }]), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    lead: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([{ status: 'NEW', _count: { _all: 4 } }]) },
  };
  return { service: new TeamActivityService(prisma as unknown as PrismaService, attendance as never), prisma };
}
const q = (extra = {}) => ({ page: 1, pageSize: 20, ...extra }) as never;

describe('TeamActivityService access', () => {
  it('is for the Super Admin only', async () => {
    const { service } = build();
    await expect(service.board(staffUser, q())).rejects.toThrow('restricted to administrators');
    await expect(service.leads(staffUser, q())).rejects.toThrow('restricted to administrators');
    await expect(service.activities(staffUser, q())).rejects.toThrow('restricted to administrators');
    await expect(service.callPhoto(staffUser, 'c1')).rejects.toThrow('restricted to administrators');
    await expect(service.board(admin, q({ date: '2026-02-31' }))).rejects.toThrow('valid date');
  });
});

describe('TeamActivityService daily board', () => {
  it('totals the whole team, counts missing reports only for people who worked, and labels technicians', async () => {
    const { service } = build();
    const board = await service.board(admin, q({ date: '2026-10-17' }));
    expect(board.totals).toEqual({ staff: 4, working: 2, onLeave: 1, reportsSubmitted: 1, reportsMissing: 1, visits: 4, orderValue: 5000 });
    expect(board.items.find((row) => row.staffId === 's1')).toMatchObject({ visits: 3, openVisits: 0, report: { calls: 2, orders: 1, value: 5000 } });
    expect(board.items.find((row) => row.staffId === 's2')).toMatchObject({ visits: 1, openVisits: 1, report: null });
    expect(board.items.find((row) => row.staffId === 's3')?.roleName).toBe('Technician');
  });

  it('pages the rows but keeps the totals for everyone, and can show only missing reports', async () => {
    const paged = await build().service.board(admin, q({ pageSize: 2 }));
    expect(paged.items).toHaveLength(2);
    expect(paged).toMatchObject({ total: 4, hasMore: true });
    expect(paged.totals.staff).toBe(4);
    const missing = await build().service.board(admin, q({ show: 'missing-report' }));
    expect(missing.items.map((row) => row.staffId)).toEqual(['s2']);
    const notWorking = await build().service.board(admin, q({ show: 'not-working' }));
    expect(notWorking.items.map((row) => row.staffId)).toEqual(['s3', 's4']);
  });
});

describe('TeamActivityService lists', () => {
  it('pages leads at the database and counts by status for the chosen staff and search', async () => {
    const { service, prisma } = build();
    const result = await service.leads(admin, q({ page: 3, pageSize: 10, staffId: 's1', status: 'NEW', search: 'glow' }));
    expect(prisma.lead.findMany.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 10, where: { assignedToId: 's1', status: 'NEW' } });
    expect(prisma.lead.groupBy.mock.calls[0]![0].where).not.toHaveProperty('status');
    expect(result.counts).toMatchObject({ NEW: 4, LOST: 0 });
  });

  it('shows follow-ups, demos and samples only, by scope, with paging and counts', async () => {
    const { service, prisma } = build();
    await service.activities(admin, q({ scope: 'overdue', page: 2, pageSize: 10 }));
    const call = prisma.clientActivity.findMany.mock.calls[0]![0];
    expect(call).toMatchObject({ skip: 10, take: 10 });
    expect(JSON.stringify(call.where)).toContain('FOLLOW_UP');
    expect(JSON.stringify(call.where)).not.toContain('"VISIT"');
    expect(prisma.clientActivity.count).toHaveBeenCalledTimes(4);
  });
});

describe('TeamActivityService own day', () => {
  it('lets a salesperson open only their own day, and nobody else', async () => {
    const { service, prisma } = build();
    Object.assign(prisma, { user: { ...prisma.user, findFirst: vi.fn().mockResolvedValue(member('staff-1', 'Asha')) }, leaveRequest: { findFirst: vi.fn().mockResolvedValue(null) }, routeStop: { findMany: vi.fn().mockResolvedValue([]) }, dailySalesReport: { ...prisma.dailySalesReport, findUnique: vi.fn().mockResolvedValue(null) } });
    (service as unknown as { attendance: { classifyStaffOnDate: unknown } }).attendance.classifyStaffOnDate = vi.fn().mockResolvedValue(new Map([['staff-1', day('PRESENT')]]));
    const result = await service.myDay(staffUser, '2026-10-17');
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'staff-1' }) }));
    expect(result).toMatchObject({ date: '2026-10-17', attendance: { status: 'PRESENT' }, report: null });
    await expect(service.myDay(admin, '2026-10-17')).rejects.toThrow('sales staff only');
  });
});

describe('TeamActivityService area manager team view', () => {
  const manager = { id: 'asm-1', portal: 'STAFF', roles: [{ key: 'SALES_MANAGER' }] } as never;

  it('is for area sales managers only', async () => {
    const { service } = build();
    await expect(service.myTeam(staffUser)).rejects.toThrow('Area Sales Managers');
    await expect(service.myTeam(admin)).rejects.toThrow('Area Sales Managers');
    await expect(service.myTeamDay(staffUser, 's1', '2026-10-17')).rejects.toThrow('Area Sales Managers');
    await expect(service.myTeamCallPhoto(staffUser, 'c1')).rejects.toThrow('Area Sales Managers');
  });

  it('shows only the people who report to the manager, with confirmed sales against their target', async () => {
    const { service, prisma } = build();
    Object.assign(prisma, {
      user: { findMany: vi.fn().mockResolvedValue([people[0], people[1]]) },
      order: { groupBy: vi.fn().mockResolvedValue([{ salespersonId: 's1', _sum: { totalAmount: 60000 }, _count: 3 }]) },
      annualTargetPlan: { findMany: vi.fn().mockResolvedValue([{ id: 'plan-1', staffId: 's1' }]) },
      target: { findMany: vi.fn().mockResolvedValue([{ annualPlanId: 'plan-1', targetValue: 100000 }]) },
    });
    const team = await service.myTeam(manager);
    expect(prisma.user.findMany.mock.calls[0]![0].where).toMatchObject({ managerId: 'asm-1', status: 'ACTIVE' });
    expect(prisma.order.groupBy.mock.calls[0]![0].where).toHaveProperty('paymentVerifiedAt');
    expect(team.items.find((item) => item.staffId === 's1')).toMatchObject({ sales: 60000, orders: 3, target: 100000, percent: 60, status: 'PRESENT' });
    expect(team.items.find((item) => item.staffId === 's2')).toMatchObject({ sales: 0, target: null, percent: null });
    expect(team.totals).toMatchObject({ members: 2, sales: 60000, target: 100000, working: 2 });
  });

  it('refuses to open someone else’s day or calendar', async () => {
    const { service, prisma } = build();
    Object.assign(prisma, { user: { ...prisma.user, findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(service.myTeamDay(manager, 's9', '2026-10-17')).rejects.toThrow('not in your team');
    await expect(service.myTeamMonth(manager, 's9', 10, 2026)).rejects.toThrow('not in your team');
    expect(prisma.user.findFirst.mock.calls[0]![0].where).toMatchObject({ id: 's9', managerId: 'asm-1' });
  });
});
