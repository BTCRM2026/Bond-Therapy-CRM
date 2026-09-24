import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AttendanceService } from './attendance.service.js';

const actor = { id: 'staff-1', portal: 'STAFF', roles: [{ key: 'SALES_EXECUTIVE' }] } as never;

function prismaFor(record: { punchInAt: Date; punchOutAt: Date | null } | null, shiftStart: string | null = null) {
  return {
    attendanceRecord: { findUnique: vi.fn().mockResolvedValue(record) },
    operationsSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    holiday: { findUnique: vi.fn().mockResolvedValue(null) },
    leaveRequest: { findFirst: vi.fn().mockResolvedValue(null) },
    staffProfile: { findUnique: vi.fn().mockResolvedValue({ shiftStart, shiftEnd: null }) },
  };
}

describe('AttendanceService status derivation', () => {
  it('keeps today as not punched instead of marking the employee absent', async () => {
    const service = new AttendanceService(prismaFor(null) as unknown as PrismaService);
    await expect(service.today(actor)).resolves.toMatchObject({ status: 'NOT_PUNCHED', workingHours: null });
  });

  it('compares shift time in India rather than the server timezone', async () => {
    const service = new AttendanceService(prismaFor({ punchInAt: new Date('2026-09-24T04:31:00.000Z'), punchOutAt: null }, '09:30') as unknown as PrismaService);
    await expect(service.today(actor)).resolves.toMatchObject({ status: 'LATE', isLate: true });
  });
});
