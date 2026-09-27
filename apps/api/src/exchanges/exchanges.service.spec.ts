import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ExchangesService } from './exchanges.service.js';

describe('ExchangesService eligibility controls', () => {
  it('rejects quantities above the delivered balance after earlier exchanges', async () => {
    const tx = {
      client: { findFirst: vi.fn().mockResolvedValue({ id: 'salon-1' }) },
      order: { findFirst: vi.fn().mockResolvedValue({ id: 'order-1', invoice: { id: 'invoice-1' }, items: [{ id: 'item-1', productId: 'product-1', quantity: 5 }] }) },
      exchangeItem: { findMany: vi.fn().mockResolvedValue([{ requestedQuantity: 3, approvedQuantity: 3 }]) },
    };
    const prisma = { $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const service = new ExchangesService(prisma as unknown as PrismaService);

    await expect(service.create(
      { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }] } as never,
      'salon-1',
      { orderId: 'order-1', items: [{ orderItemId: 'item-1', quantity: 3, reason: 'WRONG_PRODUCT' }] } as never,
    )).rejects.toThrow('2 available');
  });
});
