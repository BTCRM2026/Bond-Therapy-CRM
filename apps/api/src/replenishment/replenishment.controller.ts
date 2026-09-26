import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateReplenishmentDto, ListReplenishableProductsDto, ListReplenishmentDto, ReviewReplenishmentDto } from './dto.js';
import { ReplenishmentService } from './replenishment.service.js';

@Controller('replenishment')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.DISTRIBUTOR)
export class ReplenishmentController {
  constructor(private readonly replenishment: ReplenishmentService) {}

  @Get('products')
  listProducts(@CurrentUser() actor: SessionUser, @Query() query: ListReplenishableProductsDto) {
    return this.replenishment.listReplenishableProducts(actor, query);
  }

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListReplenishmentDto) {
    return this.replenishment.list(actor, query);
  }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateReplenishmentDto, @Req() req: Request) {
    return this.replenishment.create(actor, dto, req.ip);
  }

  @Patch(':id/approve')
  approve(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewReplenishmentDto, @Req() req: Request) {
    return this.replenishment.approve(actor, id, dto, req.ip);
  }

  @Patch(':id/reject')
  reject(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewReplenishmentDto, @Req() req: Request) {
    return this.replenishment.reject(actor, id, dto, req.ip);
  }

  @Patch(':id/fulfill')
  fulfill(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) {
    return this.replenishment.fulfill(actor, id, req.ip);
  }
}
