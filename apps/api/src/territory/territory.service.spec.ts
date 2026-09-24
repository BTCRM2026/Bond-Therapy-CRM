import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TerritoryService } from './territory.service.js';

const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;
const sales = { id: 'sales-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;

describe('TerritoryService', () => {
  it('rejects allocations when any geography level is inactive', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'sales-1', name: 'Sales User' }) },
      territory: { findUnique: vi.fn().mockResolvedValue({ id: 'territory-1', isActive: true, area: { isActive: false, city: { isActive: true, state: { isActive: true, region: { isActive: true } } } } }) },
      territoryAssignment: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new TerritoryService(prisma as unknown as PrismaService);

    await expect(service.allocate(admin, { userId: 'sales-1', territoryId: 'territory-1', effectiveFrom: '2026-09-24' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns active and historical allocations separately for staff', async () => {
    const assignments = [{ id: 'active', endDate: null }, { id: 'ended', endDate: new Date('2026-09-23') }];
    const prisma = { territoryAssignment: { findMany: vi.fn().mockResolvedValue(assignments) } };
    const service = new TerritoryService(prisma as unknown as PrismaService);

    await expect(service.mine(sales)).resolves.toEqual({ assignments, active: [assignments[0]] });
  });
});
