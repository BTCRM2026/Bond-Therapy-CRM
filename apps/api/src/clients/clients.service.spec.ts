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
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const service = new ClientsService(prisma as unknown as PrismaService);

    await service.create(
      { id: 'sales-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never,
      { salonName: 'Test Salon', category: 'SALON', primaryContact: '9876543210', city: 'Vadodara' } as never,
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'sales-1',
        status: 'ACTIVE',
        roles: { some: { role: { key: { in: ['SALES_MANAGER', 'SALES_EXECUTIVE'] }, isActive: true } } },
      },
      select: { id: true },
    });
  });
});
