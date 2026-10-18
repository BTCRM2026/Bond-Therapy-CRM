import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { describeDevice, hashDeviceToken, isDeviceToken } from './device-rules.js';
import { hashPassword } from './password.js';

const TOKEN_A = 'a'.repeat(43);
const TOKEN_B = 'b'.repeat(43);
const TOKEN_C = 'c'.repeat(43);
const chrome = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36';

async function build(devices: Array<{ id: string; tokenHash: string; label: string; lastIp: string | null }> = [], over: Record<string, unknown> = {}) {
  const passwordHash = await hashPassword('correct-password');
  const role = { key: 'SALES_EXECUTIVE', name: 'Sales Executive', portal: 'STAFF', isActive: true, priority: 40, dashboardPath: '/dashboard', permissions: [] };
  const user = { id: 'u1', name: 'Ali', loginId: 'ali', email: null, status: 'ACTIVE', failedLoginAttempts: 0, lockedUntil: null, deviceLockedAt: null, passwordHash, department: null, dataScope: 'OWN', manager: null, staffProfile: null, distributorStaffOf: null, roles: [{ role }], ...over };
  const prisma = {
    user: { findFirst: vi.fn().mockResolvedValue(user), update: vi.fn().mockResolvedValue({}) },
    staffDevice: { findMany: vi.fn().mockResolvedValue(devices), update: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({}) },
    session: { create: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
  };
  return { service: new AuthService(prisma as unknown as PrismaService), prisma };
}
const dto = { identifier: 'ali', password: 'correct-password' } as never;
const meta = (deviceToken?: string, ipAddress = '103.1.1.1') => ({ ipAddress, userAgent: chrome, deviceToken });
const saved = (token: string, label = 'Chrome on Android') => ({ id: `d-${token[0]}`, tokenHash: hashDeviceToken(token), label, lastIp: '1.1.1.1' });

describe('device helpers', () => {
  it('describes a device in plain words and accepts only well-formed tokens', () => {
    expect(describeDevice(chrome)).toBe('Chrome on Android');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/126.0 Edg/126.0')).toBe('Edge on Windows');
    expect(describeDevice('')).toBe('Unknown device');
    expect(isDeviceToken(TOKEN_A)).toBe(true);
    expect(isDeviceToken('short')).toBe(false);
    expect(isDeviceToken('bad token with spaces and enough length to pass......')).toBe(false);
  });
});

describe('staff devices at login', () => {
  it('registers the first two devices and gives each a token to keep', async () => {
    const first = await build([]);
    const one = await first.service.login(dto, meta(), 'STAFF');
    expect(one.deviceToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(first.prisma.staffDevice.create.mock.calls[0]![0].data).toMatchObject({ userId: 'u1', label: 'Chrome on Android', firstIp: '103.1.1.1' });
    expect(first.prisma.staffDevice.create.mock.calls[0]![0].data.tokenHash).toBe(hashDeviceToken(one.deviceToken!));

    const second = await build([saved(TOKEN_A)]);
    expect((await second.service.login(dto, meta(), 'STAFF')).deviceToken).toBeTruthy();
  });

  it('lets a known device in from any address, without a new token', async () => {
    const { service, prisma } = await build([saved(TOKEN_A), saved(TOKEN_B)]);
    const result = await service.login(dto, meta(TOKEN_B, '49.36.7.7'), 'STAFF');
    expect(result.deviceToken).toBeUndefined();
    expect(prisma.staffDevice.update.mock.calls[0]![0].data).toMatchObject({ lastIp: '49.36.7.7' });
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it('keeps the browser’s own token when it registers a device again after a reset', async () => {
    const { service, prisma } = await build([]);
    const result = await service.login(dto, meta(TOKEN_C), 'STAFF');
    expect(result.deviceToken).toBeUndefined();
    expect(prisma.staffDevice.create.mock.calls[0]![0].data.tokenHash).toBe(hashDeviceToken(TOKEN_C));
  });

  it('locks the account on a third device, signs it out and records who tried', async () => {
    const { service, prisma } = await build([saved(TOKEN_A, 'Chrome on Android'), saved(TOKEN_B, 'Edge on Windows')]);
    await expect(service.login(dto, meta(TOKEN_C, '117.2.2.2'), 'STAFF')).rejects.toThrow('third device');
    expect(prisma.user.update.mock.calls[0]![0].data).toMatchObject({ status: 'LOCKED', deviceLockDetail: 'Chrome on Android from 117.2.2.2' });
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.auditLog.create.mock.calls.some(([call]) => call.data.action === 'DEVICE_LIMIT_LOCK')).toBe(true);
    expect(prisma.session.create).not.toHaveBeenCalled();
  });

  it('treats a missing token (cleared browser data) as a new device', async () => {
    const { service } = await build([saved(TOKEN_A), saved(TOKEN_B)]);
    await expect(service.login(dto, meta(undefined), 'STAFF')).rejects.toThrow('third device');
  });

  it('does not apply to the admin or distributor portals', async () => {
    const { service, prisma } = await build([saved(TOKEN_A), saved(TOKEN_B)], { roles: [{ role: { key: 'SUPER_ADMIN', name: 'Super Admin', portal: 'ADMIN', isActive: true, priority: 1, dashboardPath: '/dashboard', permissions: [] } }] });
    const result = await service.login(dto, meta(TOKEN_C), 'ADMIN');
    expect(result.token).toBeTruthy();
    expect(prisma.staffDevice.findMany).not.toHaveBeenCalled();
  });

  it('tells a locked person why, but only once the password is right', async () => {
    const locked = await build([], { status: 'LOCKED', deviceLockedAt: new Date() });
    await expect(locked.service.login(dto, meta(TOKEN_A), 'STAFF')).rejects.toThrow('third device');
    await expect(locked.service.login({ identifier: 'ali', password: 'wrong-password' } as never, meta(TOKEN_A), 'STAFF')).rejects.toThrow('temporarily unavailable');
  });
});
