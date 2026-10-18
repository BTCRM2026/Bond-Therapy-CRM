import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ClientsService } from './clients.service.js';

describe('ClientsService client creation', () => {
  it('validates the assigned salesperson with an active sales role', async () => {
    const prisma = {
      client: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'client-1', salonName: 'Test Salon' }),
      },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'sales-1' }) },
      attendanceRecord: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new ClientsService(prisma as unknown as PrismaService, { assertCanStart: vi.fn() } as never);

    await service.create(
      { id: 'sales-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never,
      { salonName: 'Test Salon', category: 'SALON', primaryContact: '9876543210', city: 'Vadodara', latitude: 22.3072, longitude: 73.1812 } as never,
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sales-1',
        status: 'ACTIVE',
        roles: { some: { role: { key: { in: ['SALES_MANAGER', 'SALES_EXECUTIVE'] }, isActive: true } } },
      },
      select: { id: true },
    });
    expect(prisma.client.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientType: 'NEW_CLIENT', status: 'ACTIVE' }),
    }));
  });

  it('makes staff capture the salon location, and counts the profile as a first visit', async () => {
    const prisma = {
      client: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: 'client-1', salonName: 'Test Salon' }) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'sales-1' }) },
      attendanceRecord: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new ClientsService(prisma as unknown as PrismaService, { assertCanStart: vi.fn() } as never);
    const actor = { id: 'sales-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
    await expect(service.create(actor, { salonName: 'Test Salon', category: 'SALON', primaryContact: '9876543210', city: 'Vadodara' } as never)).rejects.toThrow('Capture the salon location');
    expect(prisma.client.create).not.toHaveBeenCalled();
    await service.create(actor, { salonName: 'Test Salon', category: 'SALON', primaryContact: '9876543210', city: 'Vadodara', latitude: 22.3, longitude: 73.1 } as never);
    expect(prisma.attendanceRecord.upsert.mock.calls[0]![0].create).toMatchObject({ userId: 'sales-1', fromVisits: true });
  });
});
