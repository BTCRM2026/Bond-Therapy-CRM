import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { DistributorStockService } from './distributor-stock.service.js';
import { ListDistributorStockDto } from './dto.js';

@Controller('distributor-stock')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.DISTRIBUTOR)
export class DistributorStockController {
  constructor(private readonly stock: DistributorStockService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListDistributorStockDto) {
    return this.stock.list(actor, query);
  }

  @Get('movements')
  movements(@CurrentUser() actor: SessionUser, @Query() query: ListDistributorStockDto) {
    return this.stock.movements(actor, query);
  }
}
