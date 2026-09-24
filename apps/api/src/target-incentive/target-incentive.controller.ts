import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { PerformanceQueryDto, UpsertPlanDto } from './dto.js';
import { TargetIncentiveService } from './target-incentive.service.js';

@Controller('target-incentive')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class TargetIncentiveController {
  constructor(private readonly targetIncentive: TargetIncentiveService) {}

  @Get('plans')
  listPlans(@CurrentUser() actor: SessionUser) { return this.targetIncentive.listPlans(actor); }

  @Post('plans')
  upsertPlan(@CurrentUser() actor: SessionUser, @Body() dto: UpsertPlanDto, @Req() req: Request) { return this.targetIncentive.upsertPlan(actor, dto, req.ip); }

  @Get('plans/:id')
  getPlan(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.targetIncentive.getPlanDetail(actor, id); }

  @Delete('plans/:id')
  deactivatePlan(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.targetIncentive.deactivatePlan(actor, id, req.ip); }

  @Get('me')
  myPerformance(@CurrentUser() actor: SessionUser, @Query() query: PerformanceQueryDto) { return this.targetIncentive.myPerformance(actor, query); }
}
