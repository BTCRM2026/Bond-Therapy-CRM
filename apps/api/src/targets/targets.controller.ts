import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { ListTargetsDto, PerformanceQueryDto, TargetDto } from './dto.js';
import { TargetsService } from './targets.service.js';

@Controller('targets')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListTargetsDto) { return this.targets.list(actor, query); }

  @Post()
  upsert(@CurrentUser() actor: SessionUser, @Body() dto: TargetDto, @Req() req: Request) { return this.targets.upsert(actor, dto, req.ip); }

  @Delete(':id')
  remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.targets.remove(actor, id, req.ip); }

  @Get('performance/me')
  myPerformance(@CurrentUser() actor: SessionUser, @Query() query: PerformanceQueryDto) { return this.targets.myPerformance(actor, query); }

  @Get('performance/admin')
  adminOverview(@CurrentUser() actor: SessionUser, @Query() query: PerformanceQueryDto) { return this.targets.adminOverview(actor, query); }
}
