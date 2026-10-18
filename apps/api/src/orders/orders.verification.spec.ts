import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.service.js';

const sales = { id: 'staff-1', name: 'Ali', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }], dataScope: 'OWN' } as never;
const admin = { id: 'admin-1', name: 'Admin', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }], dataScope: 'COMPANY' } as never;
const jpeg = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]), mimetype: 'image/jpeg', originalname: 'bill.jpg', size: 12 };

function build(order: Record<string, unknown> | null = { id: 'o1', orderNumber: 'ORD-1001', status: 'SUBMITTED', version: 3, totalAmount: { toString: () => '5000' }, paymentVerifiedAt: null, distributorInvoiceAttachment: { id: 'b1' } }) {
  const prisma = {
    order: { findFirst: vi.fn().mockResolvedValue(order), findUnique: vi.fn().mockResolvedValue(order), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'o1' }) },
    distributorInvoiceAttachment: { upsert: vi.fn().mockResolvedValue({ id: 'b1', fileName: 'bill.jpg', mime: 'image/jpeg' }), findUnique: vi.fn().mockResolvedValue(null) },
    auditLog: { create: vi.fn() },
  };
  return { service: new OrdersService(prisma as unknown as PrismaService), prisma };
}

describe('order bill and payment verification', () => {
  it('lets the salesperson attach a bill photo only before the order is sent', async () => {
    const draft = build({ id: 'o1', status: 'DRAFT' });
    expect(await draft.service.uploadBill(sales, 'o1', jpeg)).toMatchObject({ mime: 'image/jpeg' });
    expect(draft.prisma.distributorInvoiceAttachment.upsert).toHaveBeenCalled();
    await expect(build({ id: 'o1', status: 'SUBMITTED' }).service.uploadBill(sales, 'o1', jpeg)).rejects.toThrow('before the order is sent');
    await expect(build({ id: 'o1', status: 'DRAFT' }).service.uploadBill(sales, 'o1', { ...jpeg, buffer: Buffer.from('not a bill, just text') })).rejects.toThrow('genuine');
  });

  it('does not let an order be sent for verification without its bill', async () => {
    const { service } = build({ id: 'o1', status: 'DRAFT', version: 1, items: [], distributorId: null, orderNumber: 'ORD-1001' });
    await expect(service.updateStatus(sales, 'o1', { status: 'SUBMITTED', version: 1 } as never)).rejects.toThrow('Attach the distributor');
  });

  it('lets only an administrator confirm the payment, and counts the sale from that moment', async () => {
    const { service, prisma } = build();
    await expect(service.verifyPayment(sales, 'o1', { version: 3 })).rejects.toThrow('Only an administrator');
    await service.verifyPayment(admin, 'o1', { version: 3, note: 'Received in bank' });
    const call = prisma.order.updateMany.mock.calls[0]![0];
    expect(call.where).toMatchObject({ id: 'o1', version: 3, status: 'SUBMITTED', paymentVerifiedAt: null });
    expect(call.data).toMatchObject({ paymentVerifiedById: 'admin-1', paymentVerifiedNote: 'Received in bank', status: 'APPROVED' });
    expect(call.data.paymentVerifiedAt).toBeInstanceOf(Date);
  });

  it('refuses to confirm twice, without a bill, for a draft, or when the order changed meanwhile', async () => {
    await expect(build({ id: 'o1', status: 'APPROVED', paymentVerifiedAt: new Date(), distributorInvoiceAttachment: { id: 'b' } }).service.verifyPayment(admin, 'o1', { version: 1 })).rejects.toThrow('already confirmed');
    await expect(build({ id: 'o1', status: 'SUBMITTED', paymentVerifiedAt: null, distributorInvoiceAttachment: null }).service.verifyPayment(admin, 'o1', { version: 1 })).rejects.toThrow('no bill');
    await expect(build({ id: 'o1', status: 'DRAFT', paymentVerifiedAt: null, distributorInvoiceAttachment: { id: 'b' } }).service.verifyPayment(admin, 'o1', { version: 1 })).rejects.toThrow('not been sent');
    const stale = build();
    stale.prisma.order.updateMany.mockResolvedValue({ count: 0 });
    await expect(stale.service.verifyPayment(admin, 'o1', { version: 1 })).rejects.toThrow('changed');
  });

  it('lets an administrator undo a confirmation, with a reason', async () => {
    const verified = build({ id: 'o1', orderNumber: 'ORD-1001', status: 'APPROVED', paymentVerifiedAt: new Date(), version: 4 });
    await verified.service.unverifyPayment(admin, 'o1', { version: 4, reason: 'Cheque bounced' });
    expect(verified.prisma.order.updateMany.mock.calls[0]![0].data).toMatchObject({ paymentVerifiedAt: null, paymentVerifiedById: null });
    await expect(build().service.unverifyPayment(admin, 'o1', { version: 3, reason: 'Mistake' })).rejects.toThrow('not been confirmed');
    await expect(verified.service.unverifyPayment(sales, 'o1', { version: 4, reason: 'x y z' })).rejects.toThrow('Only an administrator');
  });
});
