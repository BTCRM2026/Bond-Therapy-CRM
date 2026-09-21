import { Controller, Get, UseGuards } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { WarehouseService } from './warehouse.service.js';

@Controller('warehouse')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() actor: SessionUser) { return this.warehouse.dashboard(actor); }
}
