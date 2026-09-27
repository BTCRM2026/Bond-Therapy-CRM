import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '../common/session.util.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReplenishmentService } from './replenishment.service.js';

const actor = { id: 'user-1', portal: 'DISTRIBUTOR', distributorId: 'destination-1', roles: [{ key: 'DISTRIBUTOR_OWNER', name: 'Owner' }] } as SessionUser;

function setup(partner: { parentId: string | null; partnerType: 'SUPER_STOCKIST' | 'DISTRIBUTOR' }) {
  const create = vi.fn(async ({ data }) => ({ id: 'request-1', requestNumber: data.requestNumber, ...data }));
  const tx = { employeeCounter: { upsert: vi.fn().mockResolvedValue({ nextNumber: 1001 }) }, replenishmentRequest: { create } };
  const prisma = {
    product: { findMany: vi.fn().mockResolvedValue([{ id: 'product-1' }]) },
    distributor: { findUnique: vi.fn().mockResolvedValue({ id: 'destination-1', ...partner }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return { service: new ReplenishmentService(prisma as unknown as PrismaService), create };
}

describe('Replenishment supplier routing', () => {
  it('routes a Distributor request to its assigned Super Stockist', async () => {
    const { service, create } = setup({ partnerType: 'DISTRIBUTOR', parentId: 'ss-1' });
    await service.create(actor, { items: [{ productId: 'product-1', quantity: 4 }] });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ distributorId: 'destination-1', sourceDistributorId: 'ss-1' }) }));
  });

  it('routes a Super Stockist request to Mother Depot and blocks an unassigned Distributor', async () => {
    const superStockist = setup({ partnerType: 'SUPER_STOCKIST', parentId: null });
    await superStockist.service.create(actor, { items: [{ productId: 'product-1', quantity: 2 }] });
    expect(superStockist.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sourceDistributorId: null }) }));

    const unassigned = setup({ partnerType: 'DISTRIBUTOR', parentId: null });
    await expect(unassigned.service.create(actor, { items: [{ productId: 'product-1', quantity: 2 }] })).rejects.toBeInstanceOf(ConflictException);
  });
});
