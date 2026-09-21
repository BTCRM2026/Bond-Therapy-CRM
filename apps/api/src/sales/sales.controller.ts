import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { PerformanceQueryDto } from './dto.js';
import { SalesService } from './sales.service.js';

@Controller('sales')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() actor: SessionUser) { return this.sales.dashboard(actor); }

  @Get('performance')
  performance(@CurrentUser() actor: SessionUser, @Query() query: PerformanceQueryDto) { return this.sales.performance(actor, query.month, query.year); }
}
