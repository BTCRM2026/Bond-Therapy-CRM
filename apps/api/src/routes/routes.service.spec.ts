import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RoutesService } from './routes.service.js';

describe('RoutesService visit evidence', () => {
  it('cannot complete a visit that has no GPS/photo proof', async () => {
    const prisma = {
      route: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'route-1',
          status: 'IN_PROGRESS',
          stops: [{ id: 'stop-1', clientId: 'client-1', status: 'PLANNED', activity: { id: 'activity-1', visitProof: null } }],
        }),
      },
    };
    const service = new RoutesService(prisma as unknown as PrismaService);
    const actor = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;

    await expect(service.completeVisit(actor, '2026-09-24', 'stop-1', { outcome: 'PRODUCTIVE' } as never)).rejects.toBeInstanceOf(BadRequestException);
  });
});
