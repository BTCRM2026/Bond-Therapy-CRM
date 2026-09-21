import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { GenerateIncentiveDto, PeriodQueryDto } from './dto.js';
import { IncentivesService } from './incentives.service.js';

@Controller('incentives')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class IncentivesController {
  constructor(private readonly incentives: IncentivesService) {}

  @Get('me')
  me(@CurrentUser() actor: SessionUser, @Query() query: PeriodQueryDto) { return this.incentives.me(actor, query.month, query.year); }

  @Get('team')
  teamOverview(@CurrentUser() actor: SessionUser, @Query() query: PeriodQueryDto) { return this.incentives.teamOverview(actor, query.month, query.year); }

  @Post('generate')
  generate(@CurrentUser() actor: SessionUser, @Body() dto: GenerateIncentiveDto, @Req() req: Request) { return this.incentives.generate(actor, dto, req.ip); }

  @Patch(':id/approve')
  approve(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.incentives.approve(actor, id, req.ip); }
}
