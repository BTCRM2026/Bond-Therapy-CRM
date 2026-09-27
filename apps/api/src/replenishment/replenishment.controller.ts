import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
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
@Portals(PortalType.ADMIN, PortalType.STAFF, PortalType.DISTRIBUTOR)
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
  fulfill(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewReplenishmentDto, @Req() req: Request) {
    return this.replenishment.fulfill(actor, id, dto, req.ip);
  }

  @Patch(':id/receive')
  receive(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewReplenishmentDto, @Req() req: Request) {
    return this.replenishment.receive(actor, id, dto, req.ip);
  }

  @Patch(':id/pick')
  pick(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) {
    return this.replenishment.warehouseStep(actor, id, 'PICKING', req.ip);
  }

  @Patch(':id/pack')
  pack(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) {
    return this.replenishment.warehouseStep(actor, id, 'PACKED', req.ip);
  }

  @Post(':id/invoice-attachment')
  @UseInterceptors(FileInterceptor('invoice', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadInvoice(@CurrentUser() actor: SessionUser, @Param('id') id: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException('Select an invoice to upload.');
    return this.replenishment.uploadInvoice(actor, id, file, req.ip);
  }

  @Get(':id/invoice-attachment')
  async invoiceAttachment(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Res() response: Response) {
    const file = await this.replenishment.invoiceAttachment(actor, id);
    response.setHeader('content-type', file.mime); response.setHeader('content-disposition', `inline; filename="${file.name.replaceAll('"', '')}"`); response.setHeader('cache-control', 'private, max-age=300'); response.send(file.buffer);
  }

  @Get(':id/invoice.pdf')
  async invoicePdf(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Res() response: Response) {
    const file = await this.replenishment.centralInvoicePdf(actor, id);
    response.setHeader('content-type', 'application/pdf'); response.setHeader('content-disposition', `inline; filename="${file.name}"`); response.setHeader('cache-control', 'private, max-age=300'); response.send(file.buffer);
  }

  @Post('bulk-invoices')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024, files: 1 } }))
  bulkInvoices(@CurrentUser() actor: SessionUser, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException('Select a CSV file.');
    return this.replenishment.bulkMatchInvoices(actor, file, req.ip);
  }
}
