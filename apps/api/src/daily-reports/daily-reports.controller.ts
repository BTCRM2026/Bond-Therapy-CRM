import { BadRequestException, Body, Controller, Get, Param, Post, Req, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request, Response } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { DailyReportsService } from './daily-reports.service.js';
import { SaveDailyReportDto } from './dto.js';

@Controller('daily-reports')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class DailyReportsController {
  constructor(private readonly reports: DailyReportsService) {}

  @Get('today')
  today(@CurrentUser() actor: SessionUser) { return this.reports.today(actor); }

  @Post('today')
  @UseInterceptors(AnyFilesInterceptor({ limits: { fileSize: 2 * 1024 * 1024, files: 30 } }))
  async save(@CurrentUser() actor: SessionUser, @Body('payload') payload: string, @UploadedFiles() photos: Array<{ fieldname: string; buffer: Buffer; mimetype: string; size: number }>, @Req() request: Request) {
    let parsed: unknown;
    try { parsed = JSON.parse(payload); } catch { throw new BadRequestException('The daily report could not be read. Please review it and try again.'); }
    const dto = plainToInstance(SaveDailyReportDto, parsed);
    const errors = await validate(dto, { whitelist: true });
    if (errors.length) throw new BadRequestException('Complete all required report and tomorrow-plan fields.');
    return this.reports.save(actor, dto, photos ?? [], request.ip);
  }

  @Get('calls/:callId/photo')
  async photo(@CurrentUser() actor: SessionUser, @Param('callId') callId: string, @Res() response: Response) {
    const photo = await this.reports.photo(actor, callId);
    response.setHeader('content-type', photo.mime);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'private, max-age=300');
    response.send(photo.buffer);
  }
}
