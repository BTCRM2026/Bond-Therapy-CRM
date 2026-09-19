import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService administrator password updates', () => {
  it('replaces the password and invalidates every existing staff session', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'staff-1' }),
        update: vi.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      session: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    await expect(service.updatePassword('staff-1', { password: 'updated-password' }, { id: 'admin-1' } as never)).resolves.toEqual({ ok: true });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'staff-1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('deletes only a managed staff account and keeps an audit record', async () => {
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'staff-1', loginId: 'staff.one' }),
        delete: vi.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };
    const service = new UsersService(prisma as unknown as PrismaService);
    await expect(service.remove('staff-1', { id: 'admin-1' } as never)).resolves.toEqual({ ok: true });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'staff-1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });
});
