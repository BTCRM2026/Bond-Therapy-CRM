import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { PartnerReplenishmentActionDto } from './dto.js';
import { ReplenishmentService } from './replenishment.service.js';

@Controller('partner-replenishment')
export class PartnerReplenishmentController {
  constructor(private readonly replenishment: ReplenishmentService) {}
  @Get(':token') detail(@Param('token') token: string) { return this.replenishment.partnerDetail(token); }
  @Patch(':token') action(@Param('token') token: string, @Body() dto: PartnerReplenishmentActionDto, @Req() request: Request) { return this.replenishment.partnerAction(token, dto, request.ip); }
  @Post(':token/invoice')
  @UseInterceptors(FileInterceptor('invoice', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  invoice(@Param('token') token: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string; size: number } | undefined, @Req() request: Request) { if (!file) throw new BadRequestException('Select an invoice to upload.'); return this.replenishment.partnerInvoice(token, file, request.ip); }
}
