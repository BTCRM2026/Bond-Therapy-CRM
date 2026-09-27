import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PortalType } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateExchangeDto, ListExchangesDto, UpdateExchangeStatusDto } from './dto.js';
import { ExchangesService } from './exchanges.service.js';

@Controller('exchanges')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class ExchangesController {
  constructor(private readonly exchanges: ExchangesService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListExchangesDto) { return this.exchanges.list(actor, query); }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.exchanges.detail(actor, id); }

  @Post('clients/:clientId')
  create(@CurrentUser() actor: SessionUser, @Param('clientId') clientId: string, @Body() dto: CreateExchangeDto, @Req() req: Request) { return this.exchanges.create(actor, clientId, dto, req.ip); }

  @Patch(':id/status')
  updateStatus(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateExchangeStatusDto, @Req() req: Request) { return this.exchanges.updateStatus(actor, id, dto, req.ip); }

  @Post(':id/items/:itemId/photo')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  uploadPhoto(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Param('itemId') itemId: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException('Select a product-condition photo.');
    return this.exchanges.uploadPhoto(actor, id, itemId, file, req.ip);
  }

  @Get(':id/items/:itemId/photo')
  async photo(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Param('itemId') itemId: string, @Res() response: Response) {
    const photo = await this.exchanges.photo(actor, id, itemId);
    response.setHeader('content-type', photo.mime);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'private, max-age=300');
    response.send(photo.buffer);
  }
}
