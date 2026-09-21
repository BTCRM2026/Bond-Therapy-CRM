import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { AttendanceService } from './attendance.service.js';
import { AttendanceMonthQueryDto } from './dto.js';

@Controller('attendance')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.STAFF)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() actor: SessionUser) { return this.attendance.today(actor); }

  @Post('punch-in')
  punchIn(@CurrentUser() actor: SessionUser) { return this.attendance.punchIn(actor); }

  @Post('punch-out')
  punchOut(@CurrentUser() actor: SessionUser) { return this.attendance.punchOut(actor); }

  @Get('monthly')
  monthly(@CurrentUser() actor: SessionUser, @Query() query: AttendanceMonthQueryDto) { return this.attendance.monthly(actor, query.month, query.year); }
}
