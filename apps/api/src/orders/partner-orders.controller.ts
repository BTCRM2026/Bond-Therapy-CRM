import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { UpdateOrderStatusDto } from './dto.js';
import { OrdersService } from './orders.service.js';

@Controller('partner-orders')
export class PartnerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':token')
  detail(@Param('token') token: string) { return this.orders.partnerDetail(token); }

  @Patch(':token/status')
  update(@Param('token') token: string, @Body() dto: UpdateOrderStatusDto, @Req() request: Request) { return this.orders.partnerUpdate(token, dto, request.ip); }

  @Post(':token/invoice')
  @UseInterceptors(FileInterceptor('invoice', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  invoice(@Param('token') token: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined, @Req() request: Request) {
    if (!file) throw new BadRequestException('Select an invoice to upload.');
    return this.orders.partnerInvoice(token, file, request.ip);
  }
}
