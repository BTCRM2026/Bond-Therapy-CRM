import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../common/session.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { PortalType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('roles')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.role.findMany({ orderBy: { priority: 'asc' } });
  }

  @Patch(':id')
  setActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.prisma.role.update({ where: { id }, data: { isActive: Boolean(isActive) } });
  }
}
