import type { PrismaService } from '../prisma/prisma.service.js';

export const istDateKey = (at = new Date()) => new Date(at.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);

// Field attendance comes from GPS-verified work: the first activity of the day opens it and the latest one closes it.
// Never throws: the activity that triggered it is already saved, and the next one will correct the record.
export async function markFieldWorked(prisma: Pick<PrismaService, 'attendanceRecord'>, userId: string, at: Date) {
  const date = new Date(`${istDateKey(at)}T00:00:00.000Z`);
  try {
    const existing = await prisma.attendanceRecord.findUnique({ where: { userId_date: { userId, date } } });
    const first = existing?.punchInAt && existing.punchInAt < at ? existing.punchInAt : at;
    const last = existing?.punchOutAt && existing.punchOutAt > at ? existing.punchOutAt : at;
    await prisma.attendanceRecord.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, punchInAt: at, punchOutAt: at, punchInVerified: true, punchOutVerified: true, fromVisits: true },
      update: { punchInAt: first, punchOutAt: last, fromVisits: existing?.punchInAt ? existing.fromVisits : true },
    });
  } catch {
    // intentionally ignored, see above
  }
}
