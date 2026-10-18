import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { BoardQueryDto, DayQueryDto, TeamActivitiesQueryDto, TeamLeadsQueryDto } from './dto.js';
import { TeamActivityService } from './team-activity.service.js';

// A salesperson's own day (attendance, visits and Daily Report) for the calendar in Attendance.
@Controller('my-day')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class MyDayController {
  constructor(private readonly team: TeamActivityService) {}

  @Get(':date')
  day(@CurrentUser() actor: SessionUser, @Param() params: DayQueryDto) { return this.team.myDay(actor, params.date); }
}

// Read-only monitoring of everything the sales staff do, for the Super Admin.
@Controller('team-activity')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class TeamActivityController {
  constructor(private readonly team: TeamActivityService) {}

  @Get('staff')
  staff(@CurrentUser() actor: SessionUser) { return this.team.staffOptions(actor); }

  @Get('board')
  board(@CurrentUser() actor: SessionUser, @Query() query: BoardQueryDto) { return this.team.board(actor, query); }

  @Get('day/:staffId')
  day(@CurrentUser() actor: SessionUser, @Param('staffId') staffId: string, @Query() query: DayQueryDto) { return this.team.dayDetail(actor, staffId, query.date); }

  @Get('calls/:callId/photo')
  async photo(@CurrentUser() actor: SessionUser, @Param('callId') callId: string, @Res() response: Response) {
    const photo = await this.team.callPhoto(actor, callId);
    response.setHeader('content-type', photo.mime);
    response.setHeader('content-disposition', 'inline');
    response.setHeader('cache-control', 'private, max-age=300');
    response.send(photo.buffer);
  }

  @Get('leads')
  leads(@CurrentUser() actor: SessionUser, @Query() query: TeamLeadsQueryDto) { return this.team.leads(actor, query); }

  @Get('activities')
  activities(@CurrentUser() actor: SessionUser, @Query() query: TeamActivitiesQueryDto) { return this.team.activities(actor, query); }
}
