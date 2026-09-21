import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateOrderDto, ListOrdersDto, UpdateOrderStatusDto } from './dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListOrdersDto) { return this.orders.list(actor, query); }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.orders.detail(actor, id); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateOrderDto, @Req() req: Request) { return this.orders.create(actor, dto, req.ip); }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() req: Request) { return this.orders.updateStatus(actor, id, dto, req.ip); }
}
