import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { ListProductsDto, ProductDto, SetProductActiveDto, StockMovementDto } from './dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListProductsDto) { return this.products.list(actor, query); }

  @Get('stats')
  stats(@CurrentUser() actor: SessionUser) { return this.products.stats(actor); }

  @Get('movements')
  listMovements(@CurrentUser() actor: SessionUser, @Query('productId') productId?: string) { return this.products.listMovements(actor, productId); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: ProductDto, @Req() req: Request) { return this.products.create(actor, dto, req.ip); }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ProductDto, @Req() req: Request) { return this.products.update(actor, id, dto, req.ip); }

  @Patch(':id/active')
  setActive(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: SetProductActiveDto, @Req() req: Request) { return this.products.setActive(actor, id, dto, req.ip); }

  @Delete(':id')
  remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.products.remove(actor, id, req.ip); }

  @Post(':id/movements')
  recordMovement(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: StockMovementDto, @Req() req: Request) { return this.products.recordMovement(actor, id, dto, req.ip); }
}
