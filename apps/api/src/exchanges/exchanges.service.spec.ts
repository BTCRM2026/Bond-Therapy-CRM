import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { fakeJpeg } from '../captures/jpeg.testkit.js';
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

describe('ExchangesService condition photo guard', () => {
  const requester = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;
  const build = () => {
    const exchange = { id: 'ex-1', status: 'SUBMITTED', requestedById: 'staff-1', requestedBy: { id: 'staff-1' }, items: [{ id: 'item-1' }] };
    const prisma = { exchange: { findFirst: vi.fn().mockResolvedValue(exchange), findUnique: vi.fn().mockResolvedValue(exchange) }, exchangeItem: { update: vi.fn() }, auditLog: { create: vi.fn() } };
    const captures = { consume: vi.fn().mockResolvedValue(undefined) };
    const service = new ExchangesService(prisma as unknown as PrismaService, captures as never);
    vi.spyOn(service as unknown as { getVisible: () => Promise<unknown> }, 'getVisible').mockResolvedValue(exchange);
    return { service, prisma, captures };
  };

  it('stores a live-camera photo as JPEG and uses up the camera pass', async () => {
    const { service, prisma, captures } = build();
    const buffer = fakeJpeg();
    await service.uploadPhoto(requester, 'ex-1', 'item-1', { buffer, mimetype: 'image/webp', size: buffer.length }, 'd'.repeat(48));
    expect(captures.consume).toHaveBeenCalledWith('staff-1', 'd'.repeat(48), 'EXCHANGE_ITEM');
    expect(prisma.exchangeItem.update.mock.calls[0]![0].data).toMatchObject({ conditionPhotoMime: 'image/jpeg' });
  });

  it('refuses gallery-style photos without spending the camera pass', async () => {
    const { service, prisma, captures } = build();
    const buffer = fakeJpeg({ exif: true });
    await expect(service.uploadPhoto(requester, 'ex-1', 'item-1', { buffer, mimetype: 'image/jpeg', size: buffer.length }, 'd'.repeat(48))).rejects.toThrow('in-app camera');
    expect(captures.consume).not.toHaveBeenCalled();
    expect(prisma.exchangeItem.update).not.toHaveBeenCalled();
  });
});
