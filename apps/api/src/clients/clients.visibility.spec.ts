import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ClientsService } from './clients.service.js';

const staff = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }], dataScope: 'OWN' } as never;
const admin = { id: 'admin-1', portal: 'ADMIN', roles: [{ key: 'SUPER_ADMIN' }], dataScope: 'COMPANY' } as never;

function build() {
  const prisma = { client: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) }, $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)) };
  return { service: new ClientsService(prisma as unknown as PrismaService, { assertCanStart: vi.fn() } as never), prisma };
}

describe('client list and salons typed into a route', () => {
  it('keeps salons whose profile is not filled out of a salesperson’s client list', async () => {
    const { service, prisma } = build();
    await service.list(staff, { page: 1, pageSize: 20 } as never);
    const filters = JSON.stringify(prisma.client.findMany.mock.calls[0]![0].where);
    expect(filters).toContain('"profileIncomplete":false');
  });

  it('lets the administrator see everything, or only the unfilled ones', async () => {
    const all = build();
    await all.service.list(admin, { page: 1, pageSize: 20 } as never);
    expect(JSON.stringify(all.prisma.client.findMany.mock.calls[0]![0].where)).not.toContain('profileIncomplete');
    const only = build();
    await only.service.list(admin, { page: 1, pageSize: 20, profileIncomplete: 'true' } as never);
    expect(JSON.stringify(only.prisma.client.findMany.mock.calls[0]![0].where)).toContain('"profileIncomplete":true');
    const sneaky = build();
    await sneaky.service.list(staff, { page: 1, pageSize: 20, profileIncomplete: 'true' } as never);
    expect(JSON.stringify(sneaky.prisma.client.findMany.mock.calls[0]![0].where)).not.toContain('"profileIncomplete":true');
  });
});
