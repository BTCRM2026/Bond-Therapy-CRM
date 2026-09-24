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
import { AdminVisitsDto, CompleteVisitDto, SaveRouteDto, StartVisitDto, StopStatusDto } from './dto.js';
import { RoutesService } from './routes.service.js';

@Controller('routes')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get('salons')
  salons(@CurrentUser() actor: SessionUser) { return this.routes.assignedSalons(actor); }

  @Get('admin')
  admin(@CurrentUser() actor: SessionUser, @Query('date') date: string) { return this.routes.adminOverview(actor, date); }

  @Get('admin/visits')
  adminVisits(@CurrentUser() actor: SessionUser, @Query() query: AdminVisitsDto) { return this.routes.adminVisits(actor, query); }

  @Get('admin/visits/:stopId')
  evidence(@CurrentUser() actor: SessionUser, @Param('stopId') stopId: string) { return this.routes.visitEvidence(actor, stopId); }

  @Get('stops/:stopId/photo')
  async photo(@CurrentUser() actor: SessionUser, @Param('stopId') stopId: string, @Query('kind') kind: string | undefined, @Res() response: Response) {
    const proof = await this.routes.visitPhoto(actor, stopId, kind === 'out' ? 'out' : 'in');
    response.setHeader('content-type', proof.mime);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'private, max-age=300');
    response.send(proof.buffer);
  }

  @Get(':date')
  get(@CurrentUser() actor: SessionUser, @Param('date') date: string) { return this.routes.getRoute(actor, date); }

  @Post(':date')
  save(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Body() dto: SaveRouteDto, @Req() req: Request) { return this.routes.saveRoute(actor, date, dto, req.ip); }

  @Post(':date/submit')
  submit(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Req() req: Request) { return this.routes.submit(actor, date, req.ip); }

  @Patch(':date/stops/:stopId/status')
  setStopStatus(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string, @Body() dto: StopStatusDto, @Req() req: Request) { return this.routes.setStopStatus(actor, date, stopId, dto, req.ip); }

  @Post(':date/stops/:stopId/start')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  start(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string, @Body() dto: StartVisitDto, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException('Capture a check-in photo before starting the visit.');
    return this.routes.startVisit(actor, date, stopId, dto, file, req.ip);
  }

  @Post(':date/stops/:stopId/complete')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  complete(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string, @Body() dto: CompleteVisitDto, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Req() req: Request) {
    if (!file) throw new BadRequestException('Capture a check-out selfie before completing the visit.');
    return this.routes.completeVisit(actor, date, stopId, dto, file, req.ip);
  }
}
