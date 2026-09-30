import { ConflictException, NotFoundException } from '@nestjs/common';
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

  it('dispatches an accepted Mother Depot request without picking and packing clicks', async () => {
    const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN', name: 'Super Admin' }] } as SessionUser;
    const request = {
      id: 'request-1', requestNumber: 'REPL-1001', status: 'APPROVED', sourceDistributorId: null, distributorId: 'destination-1',
      items: [{ id: 'item-1', productId: 'product-1', quantity: 2, acceptedQuantity: 2, product: { name: 'Shampoo' } }],
    };
    const update = vi.fn().mockResolvedValue({ ...request, status: 'DISPATCHED', invoiceReference: 'BT/REP/26-27/00001' });
    const tx = {
      employeeCounter: { upsert: vi.fn().mockResolvedValue({ nextNumber: 1 }) },
      product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
      replenishmentItem: { update: vi.fn().mockResolvedValue({}) },
      replenishmentRequest: { update, updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      replenishmentRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const service = new ReplenishmentService(prisma as unknown as PrismaService);
    await expect(service.fulfill(admin, request.id, {})).resolves.toMatchObject({ status: 'DISPATCHED' });
    expect(tx.replenishmentRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: request.id }) }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'DISPATCHED' }) }));
  });

  it('does not credit stock when receipt was already claimed', async () => {
    const request = { id: 'request-1', status: 'DISPATCHED', distributorId: 'destination-1', sourceDistributorId: 'ss-1', items: [{ id: 'item-1', productId: 'product-1', quantity: 2, acceptedQuantity: 2, dispatchedQuantity: 2 }] };
    const tx = {
      replenishmentRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      distributorStock: { upsert: vi.fn() },
    };
    const prisma = {
      replenishmentRequest: { findUnique: vi.fn().mockResolvedValue(request) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const service = new ReplenishmentService(prisma as unknown as PrismaService);
    await expect(service.receive(actor, request.id, {})).rejects.toBeInstanceOf(ConflictException);
    expect(tx.distributorStock.upsert).not.toHaveBeenCalled();
  });

  it('opens legacy links by a secure shortened token prefix', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'request-1', sourceDistributorId: 'ss-1', createdAt: new Date(), status: 'REQUESTED' });
    const service = new ReplenishmentService({ replenishmentRequest: { findFirst } } as unknown as PrismaService);
    const token = 'a'.repeat(24);

    await expect(service.partnerDetail(token)).resolves.toMatchObject({ id: 'request-1' });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { confirmationToken: { startsWith: token } } }));
    await expect(service.partnerDetail('too-short')).rejects.toBeInstanceOf(NotFoundException);
  });
});
