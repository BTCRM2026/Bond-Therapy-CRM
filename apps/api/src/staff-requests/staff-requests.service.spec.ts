import { describe, expect, it, vi } from 'vitest';
import { StaffRequestsService } from './staff-requests.service.js';

const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
const staff = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const other = { id: 'staff-2', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
const request = (status: string) => ({ id: 'r1', requestNumber: 'REQ-2026-0001', title: 't', details: 'd', status, requesterId: 'staff-1', requester: { id: 'staff-1', name: 'S' }, decidedBy: null, decidedAt: null, approvedValue: null, validUntil: null, createdAt: new Date(), events: [] });

function build(status = 'SUBMITTED') {
  const update = vi.fn().mockImplementation(async ({ data }) => ({ ...request(data.status ?? status), ...data, events: [] }));
  const prisma = { staffRequest: { findUnique: vi.fn().mockResolvedValue(request(status)), update }, auditLog: { create: vi.fn() } };
  return { service: new StaffRequestsService(prisma as never), update };
}

describe('StaffRequestsService', () => {
  it('requires a reason to reject and a question to ask for more info', async () => {
    const { service, update } = build();
    await expect(service.decide(admin, 'r1', { decision: 'REJECT' })).rejects.toThrow('reason');
    await expect(service.decide(admin, 'r1', { decision: 'NEED_INFO', comment: '  ' })).rejects.toThrow('information');
    expect(update).not.toHaveBeenCalled();
  });

  it('approves without a comment and keeps the optional scheme details', async () => {
    const { service, update } = build();
    await service.decide(admin, 'r1', { decision: 'APPROVE', approvedValue: ' 10% on Brand X ', validUntil: '2026-12-31' });
    expect(update.mock.calls[0]![0].data).toMatchObject({ status: 'APPROVED', approvedValue: '10% on Brand X', decidedById: 'admin-1' });
  });

  it('does not let staff decide, other staff see it, or a closed request change', async () => {
    await expect(build().service.decide(staff, 'r1', { decision: 'APPROVE' })).rejects.toThrow('administrator');
    await expect(build().service.detail(other, 'r1')).rejects.toThrow('not found');
    await expect(build('APPROVED').service.decide(admin, 'r1', { decision: 'REJECT', comment: 'x' })).rejects.toThrow('closed');
  });

  it('lets only the requester reply, and only while more info is requested', async () => {
    await expect(build('SUBMITTED').service.reply(staff, 'r1', 'ok')).rejects.toThrow('not waiting');
    const { service, update } = build('NEEDS_INFO');
    await service.reply(staff, 'r1', ' here you go ');
    expect(update.mock.calls[0]![0].data).toMatchObject({ status: 'SUBMITTED' });
  });
});
