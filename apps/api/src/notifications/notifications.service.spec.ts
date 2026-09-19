import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService portal and account isolation', () => {
  it('lists only notifications owned by the signed-in user in the current portal', async () => {
    const prisma = { notification: { findMany: vi.fn().mockResolvedValue([]) } };
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
