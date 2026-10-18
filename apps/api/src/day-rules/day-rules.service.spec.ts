import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { DayRulesService } from './day-rules.service.js';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const sales = [{ role: { key: 'SALES_EXECUTIVE' } }];

function build(over: { from?: string | null; report?: unknown; approval?: unknown; created?: string; roles?: unknown; leaves?: unknown[]; holidays?: unknown[] } = {}) {
  const prisma = {
    operationsSettings: { findUnique: vi.fn().mockResolvedValue({ strictDayRulesFrom: over.from === null ? null : day(over.from ?? '2026-10-17'), weeklyOffDays: [0] }) },
    holiday: { findMany: vi.fn().mockResolvedValue(over.holidays ?? []) },
    leaveRequest: { findMany: vi.fn().mockResolvedValue(over.leaves ?? []) },
    user: { findUnique: vi.fn().mockResolvedValue({ createdAt: new Date(`${over.created ?? '2026-09-01'}T06:00:00Z`), roles: over.roles ?? sales }), findFirst: vi.fn() },
    dailySalesReport: { findUnique: vi.fn().mockResolvedValue(over.report ?? null), findMany: vi.fn().mockResolvedValue([]) },
    dayStartApproval: { findUnique: vi.fn().mockResolvedValue(over.approval ?? null), upsert: vi.fn().mockResolvedValue({ id: 'a1' }) },
    clientActivity: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { create: vi.fn() },
  };
  return { service: new DayRulesService(prisma as unknown as PrismaService), prisma };
}
// Tuesday 20 Oct 2026, 10:00 IST.
const tuesday = new Date('2026-10-20T04:30:00Z');

describe('DayRulesService start-of-day block', () => {
  it('blocks the morning after a missing report until an administrator approves', async () => {
    const gate = await build().service.gate('u1', tuesday);
    expect(gate).toMatchObject({ blocked: true, approved: false, requiredDate: '2026-10-19' });
    expect(gate.message).toContain('2026-10-19');
  });

  it('lets the day start when the report exists, or after the administrator approved the start', async () => {
    expect((await build({ report: { id: 'r1' } }).service.gate('u1', tuesday)).blocked).toBe(false);
    expect(await build({ approval: { id: 'a1' } }).service.gate('u1', tuesday)).toMatchObject({ blocked: false, approved: true });
  });

  it('asks for the last working day, skipping the weekly off, a holiday or approved leave', async () => {
    const monday = new Date('2026-10-19T04:30:00Z');
    expect(await build().service.gate('u1', monday)).toMatchObject({ blocked: true, requiredDate: '2026-10-17' });
    const holiday = await build({ holidays: [{ date: day('2026-10-19') }] }).service.gate('u1', tuesday);
    expect(holiday).toMatchObject({ blocked: true, requiredDate: '2026-10-17' });
    const leave = await build({ leaves: [{ startDate: day('2026-10-19'), endDate: day('2026-10-19') }] }).service.gate('u1', tuesday);
    expect(leave).toMatchObject({ blocked: true, requiredDate: '2026-10-17' });
  });

  it('does not apply before the start date, to non-sales staff, or to a day the account did not exist for', async () => {
    expect((await build({ from: null }).service.gate('u1', tuesday)).blocked).toBe(false);
    expect((await build({ from: '2026-10-20' }).service.gate('u1', tuesday)).blocked).toBe(false);
    expect((await build({ roles: [{ role: { key: 'WAREHOUSE' } }] }).service.gate('u1', tuesday)).blocked).toBe(false);
    expect((await build({ created: '2026-10-19' }).service.gate('u1', tuesday)).blocked).toBe(false);
  });

  it('lets only an administrator approve a day start', async () => {
    const { service, prisma } = build();
    const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', name: 'Ali' });
    const approved = await service.approveStart(admin, 'u1', 'Was on a client visit');
    expect(prisma.dayStartApproval.upsert).toHaveBeenCalled();
    expect(approved).toMatchObject({ userId: 'u1', name: 'Ali' });
    await expect(service.approveStart({ id: 'u2', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never, 'u1')).rejects.toThrow('administrator');
  });
});

describe('DayRulesService facts', () => {
  it('counts a visit on the India calendar day it happened and records the report time', async () => {
    const { service, prisma } = build();
    // 01:30 AM IST on the 18th is still 20:00 UTC on the 17th.
    prisma.clientActivity.findMany.mockResolvedValue([{ createdById: 'u1', checkInAt: new Date('2026-10-17T20:00:00Z') }, { createdById: 'u1', checkInAt: new Date('2026-10-17T05:00:00Z') }]);
    prisma.dailySalesReport.findMany.mockResolvedValue([{ staffId: 'u1', reportDate: day('2026-10-17'), submittedAt: new Date('2026-10-17T14:00:00Z') }]);
    const facts = await service.facts(['u1'], day('2026-10-17'), day('2026-10-19'));
    expect(service.factsFor(facts, 'u1', '2026-10-17')).toMatchObject({ verifiedCalls: 1, reportSubmittedAt: new Date('2026-10-17T14:00:00Z') });
    expect(service.factsFor(facts, 'u1', '2026-10-18').verifiedCalls).toBe(1);
    expect(service.factsFor(facts, 'u1', '2026-10-19')).toEqual({ verifiedCalls: 0, reportSubmittedAt: null });
  });
});
