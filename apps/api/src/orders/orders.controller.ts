import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateOrderDto, ListOrdersDto, UpdateOrderDto, UpdateOrderStatusDto } from './dto.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF, PortalType.DISTRIBUTOR)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListOrdersDto) { return this.orders.list(actor, query); }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.orders.detail(actor, id); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateOrderDto, @Req() req: Request) { return this.orders.create(actor, dto, req.ip); }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateOrderDto, @Req() req: Request) { return this.orders.update(actor, id, dto, req.ip); }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @Req() req: Request) { return this.orders.updateStatus(actor, id, dto, req.ip); }

  @Post(':id/delivery-proof/:kind')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadProof(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Param('kind') rawKind: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Request) {
    if (rawKind !== 'arrival' && rawKind !== 'delivery') throw new BadRequestException('Invalid proof type.');
    if (!file) throw new BadRequestException('Select a photo to upload.');
    return this.orders.uploadDeliveryProof(actor, id, rawKind, file, req.ip);
  }

  @Get(':id/delivery-proof/:kind')
  async proof(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Param('kind') rawKind: string, @Res() response: Response) {
    if (rawKind !== 'arrival' && rawKind !== 'delivery') throw new BadRequestException('Invalid proof type.');
    const proof = await this.orders.deliveryProof(actor, id, rawKind);
    response.setHeader('content-type', proof.mime);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'private, max-age=300');
    response.send(proof.buffer);
  }
}
