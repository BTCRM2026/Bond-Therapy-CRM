import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { IncentiveRuleDto, IncentiveRuleVersionDto, RejectCalculationDto, RunCalculationDto } from './dto.js';
import { IncentiveRulesService } from './incentive-rules.service.js';

@Controller('incentive-rules')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class IncentiveRulesController {
  constructor(private readonly incentiveRules: IncentiveRulesService) {}

  @Get()
  listRules(@CurrentUser() actor: SessionUser) { return this.incentiveRules.listRules(actor); }

  @Post()
  createRule(@CurrentUser() actor: SessionUser, @Body() dto: IncentiveRuleDto, @Req() req: Request) { return this.incentiveRules.createRule(actor, dto, req.ip); }

  @Post(':id/versions')
  createVersion(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: IncentiveRuleVersionDto, @Req() req: Request) { return this.incentiveRules.createVersion(actor, id, dto, req.ip); }

  @Post('versions/:id/run')
  run(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: RunCalculationDto, @Req() req: Request) { return this.incentiveRules.runCalculation(actor, id, dto, req.ip); }

  @Get('calculations')
  calculations(@CurrentUser() actor: SessionUser, @Query('status') status?: string) { return this.incentiveRules.listCalculations(actor, { status }); }

  @Patch('calculations/:id/approve')
  approve(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.incentiveRules.approve(actor, id, req.ip); }

  @Patch('calculations/:id/reject')
  reject(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: RejectCalculationDto, @Req() req: Request) { return this.incentiveRules.reject(actor, id, dto, req.ip); }

  @Patch('calculations/:id/paid')
  markPaid(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.incentiveRules.markPaid(actor, id, req.ip); }
}
