import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

describe('ProductsService search', () => {
  it('adds a title-cased search variant for case-sensitive databases', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = {
      product: { findMany, count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);
    const actor = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never;

    await service.list(actor, { page: 1, pageSize: 10, search: 'argan oil' } as never);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ OR: expect.arrayContaining([{ name: { contains: 'Argan Oil' } }]) }] },
    }));
  });
});
