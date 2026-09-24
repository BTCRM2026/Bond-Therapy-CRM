import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CompleteVisitDto, SaveRouteDto, StopStatusDto } from './dto.js';
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

  @Get(':date')
  get(@CurrentUser() actor: SessionUser, @Param('date') date: string) { return this.routes.getRoute(actor, date); }

  @Post(':date')
  save(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Body() dto: SaveRouteDto, @Req() req: Request) { return this.routes.saveRoute(actor, date, dto, req.ip); }

  @Post(':date/submit')
  submit(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Req() req: Request) { return this.routes.submit(actor, date, req.ip); }

  @Patch(':date/stops/:stopId/status')
  setStopStatus(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string, @Body() dto: StopStatusDto, @Req() req: Request) { return this.routes.setStopStatus(actor, date, stopId, dto, req.ip); }

  @Post(':date/stops/:stopId/start')
  start(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string) { return this.routes.startVisit(actor, date, stopId); }

  @Post(':date/stops/:stopId/complete')
  complete(@CurrentUser() actor: SessionUser, @Param('date') date: string, @Param('stopId') stopId: string, @Body() dto: CompleteVisitDto, @Req() req: Request) { return this.routes.completeVisit(actor, date, stopId, dto, req.ip); }
}
