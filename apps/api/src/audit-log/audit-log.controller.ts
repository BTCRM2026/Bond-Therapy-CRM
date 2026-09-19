import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../common/session.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { PortalType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('audit-log')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class AuditLogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query('entity') entity?: string, @Query('take') take = '50') {
    const takeNumber = Math.min(Number(take) || 50, 200);
    return this.prisma.auditLog.findMany({
      where: entity ? { entity } : undefined,
      include: { actor: { select: { id: true, name: true, loginId: true } } },
      orderBy: { createdAt: 'desc' },
      take: takeNumber,
    });
  }
}
