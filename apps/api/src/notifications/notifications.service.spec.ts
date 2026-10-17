import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService portal and account isolation', () => {
  it('lists only notifications owned by the signed-in user in the current portal', async () => {
    const prisma = { notification: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() }, staffRequest: { count: vi.fn().mockResolvedValue(0) } };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    await service.list({ id: 'staff-1', portal: 'STAFF', roles: [] } as never);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { recipientId: 'staff-1', portal: 'STAFF' },
    }));
  });

  it('does not allow one account to mark another account notification as read', async () => {
    const prisma = { notification: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() } };
    const service = new NotificationsService(prisma as unknown as PrismaService);
    await expect(service.markRead('notification-2', { id: 'staff-1', portal: 'STAFF' } as never)).rejects.toThrow('Notification not found.');
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

describe('NotificationsService read state', () => {
  const alert = { type: 'STAFF_REQUEST_PENDING', severity: 'INFO' as const, title: 'Requests pending', message: '2 requests waiting for your decision.', sourceKey: 'k:u1', portal: 'ADMIN' as const, recipientId: 'u1' };
  const build = (existing: { message: string } | null) => {
    const notification = { findUnique: vi.fn().mockResolvedValue(existing), create: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 3 }) };
    return { notification, service: new NotificationsService({ notification } as unknown as PrismaService) as unknown as { notifyOnChange: (data: typeof alert) => Promise<void>; markAllRead: (user: unknown) => Promise<{ updated: number }> } };
  };

  it('keeps an already-read alert read when its text has not changed', async () => {
    const { notification, service } = build({ message: alert.message });
    await service.notifyOnChange(alert);
    expect(notification.update).not.toHaveBeenCalled();
    expect(notification.create).not.toHaveBeenCalled();
  });

  it('creates a new alert, and marks an existing one unread only when its text changes', async () => {
    const fresh = build(null);
    await fresh.service.notifyOnChange(alert);
    expect(fresh.notification.create).toHaveBeenCalledWith({ data: alert });
    const changed = build({ message: '1 request waiting for your decision.' });
    await changed.service.notifyOnChange(alert);
    expect(changed.notification.update.mock.calls[0]![0].data).toEqual({ message: alert.message, isRead: false });
  });

  it('marks all of the signed-in user’s unread notifications read in their own portal only', async () => {
    const { notification, service } = build(null);
    expect(await service.markAllRead({ id: 'u1', portal: 'STAFF' })).toEqual({ updated: 3 });
    expect(notification.updateMany).toHaveBeenCalledWith({ where: { recipientId: 'u1', portal: 'STAFF', isRead: false }, data: { isRead: true } });
  });
});
