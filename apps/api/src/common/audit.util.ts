import { PrismaService } from '../prisma/prisma.service.js';

export async function recordAudit(
  prisma: PrismaService,
  params: { actorId?: string; action: string; entity: string; entityId?: string; details?: unknown; ipAddress?: string },
) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details as never,
      ipAddress: params.ipAddress,
    },
  });
}
