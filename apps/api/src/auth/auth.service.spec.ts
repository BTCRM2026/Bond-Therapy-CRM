import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';

function serviceWith(prisma: object) {
  return new AuthService(prisma as PrismaService);
}

describe('AuthService profile settings', () => {
  it('normalizes profile updates and writes them with an audit record', async () => {
    const updated = { id: 'user-1', name: 'Bond User', email: 'user@bond.test' };
    const prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(updated),
      },
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    };

    await expect(serviceWith(prisma).updateProfile('user-1', { name: '  Bond User  ', email: 'USER@BOND.TEST' })).resolves.toEqual(updated);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { name: 'Bond User', email: 'user@bond.test' } }));
    expect(prisma.auditLog.create).toHaveBeenCalledOnce();
  });

  it('rejects an incorrect current password without changing data', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ passwordHash: await hashPassword('correct-password') }) },
    };

    await expect(serviceWith(prisma).changePassword('user-1', { currentPassword: 'wrong-password', newPassword: 'new-password' }, 'ADMIN')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not allow Staff portal users to change administrator-managed passwords', async () => {
    await expect(serviceWith({}).changePassword('user-1', { currentPassword: 'current-password', newPassword: 'new-password' }, 'STAFF')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
