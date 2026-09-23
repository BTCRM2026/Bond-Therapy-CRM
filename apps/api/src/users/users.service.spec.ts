import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

describe('UsersService administrator password updates', () => {
  it('starts Bond Therapy employee codes at BT-01', async () => {
    const createdAt = new Date('2026-09-23T00:00:00.000Z');
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'staff-1',
          loginId: 'new.staff.bt01',
          email: 'new.staff@example.com',
          name: 'New Staff',
          status: 'ACTIVE',
          department: 'SALES',
          dataScope: 'TEAM',
          managerId: null,
          lastLoginAt: null,
          createdAt,
          manager: null,
          roles: [{ role: { key: 'SALES_MANAGER', name: 'Sales Manager', portal: 'STAFF' } }],
          staffProfile: { employeeCode: 'BT-01' },
        }),
      },
      role: { findFirst: vi.fn().mockResolvedValue({ id: 'role-1', key: 'SALES_MANAGER' }) },
      employeeCounter: { upsert: vi.fn().mockResolvedValue({ key: 'BT', nextNumber: 1 }) },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
    };
    const service = new UsersService(prisma as unknown as PrismaService);

    await service.create({
      name: 'New Staff',
      email: 'new.staff@example.com',
      password: 'secure-password',
      roleKey: 'SALES_MANAGER',
      mobile: '9000000001',
      jobTitle: 'Manager',
      employmentType: 'FULL_TIME',
      joiningDate: '2026-09-23',
    }, { id: 'admin-1' } as never);

    expect(prisma.employeeCounter.upsert).toHaveBeenCalledWith({
      where: { key: 'BT' },
      create: { key: 'BT', nextNumber: 1 },
      update: { nextNumber: { increment: 1 } },
    });
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        loginId: 'new.staff.bt01',
        staffProfile: { create: expect.objectContaining({ employeeCode: 'BT-01' }) },
      }),
    }));
  });

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
