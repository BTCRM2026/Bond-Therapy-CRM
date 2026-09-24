import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { AttendanceService } from './attendance.service.js';
import { AdminAttendanceListDto, AttendanceMonthQueryDto, HolidayDto, PunchDto, RequestCorrectionDto, RequestLeaveDto, ReviewRequestDto, UpdateOperationsSettingsDto } from './dto.js';

@Controller('attendance')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('today')
  today(@CurrentUser() actor: SessionUser) { return this.attendance.today(actor); }

  @Post('punch-in')
  punchIn(@CurrentUser() actor: SessionUser, @Body() dto: PunchDto, @Req() req: Request) { return this.attendance.punchIn(actor, dto, req.ip); }

  @Post('punch-out')
  punchOut(@CurrentUser() actor: SessionUser, @Body() dto: PunchDto, @Req() req: Request) { return this.attendance.punchOut(actor, dto, req.ip); }

  @Get('monthly')
  monthly(@CurrentUser() actor: SessionUser, @Query() query: AttendanceMonthQueryDto) { return this.attendance.monthly(actor, query.month, query.year); }

  @Post('corrections')
  requestCorrection(@CurrentUser() actor: SessionUser, @Body() dto: RequestCorrectionDto, @Req() req: Request) { return this.attendance.requestCorrection(actor, dto, req.ip); }

  @Get('corrections/mine')
  myCorrections(@CurrentUser() actor: SessionUser) { return this.attendance.myCorrectionRequests(actor); }

  @Get('corrections')
  listCorrections(@CurrentUser() actor: SessionUser, @Query('status') status?: string) { return this.attendance.listCorrectionRequests(actor, status); }

  @Patch('corrections/:id/review')
  reviewCorrection(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewRequestDto, @Req() req: Request) { return this.attendance.reviewCorrection(actor, id, dto, req.ip); }

  @Post('leave')
  requestLeave(@CurrentUser() actor: SessionUser, @Body() dto: RequestLeaveDto, @Req() req: Request) { return this.attendance.requestLeave(actor, dto, req.ip); }

  @Get('leave/mine')
  myLeave(@CurrentUser() actor: SessionUser) { return this.attendance.myLeaveRequests(actor); }

  @Get('leave')
  listLeave(@CurrentUser() actor: SessionUser, @Query('status') status?: string) { return this.attendance.listLeaveRequests(actor, status); }

  @Patch('leave/:id/review')
  reviewLeave(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewRequestDto, @Req() req: Request) { return this.attendance.reviewLeave(actor, id, dto, req.ip); }

  @Get('holidays')
  listHolidays(@CurrentUser() actor: SessionUser) { return this.attendance.listHolidays(actor); }

  @Post('holidays')
  createHoliday(@CurrentUser() actor: SessionUser, @Body() dto: HolidayDto, @Req() req: Request) { return this.attendance.createHoliday(actor, dto, req.ip); }

  @Delete('holidays/:id')
  deleteHoliday(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.attendance.deleteHoliday(actor, id, req.ip); }

  @Get('settings')
  getSettings(@CurrentUser() actor: SessionUser) { return this.attendance.getSettings(actor); }

  @Patch('settings')
  updateSettings(@CurrentUser() actor: SessionUser, @Body() dto: UpdateOperationsSettingsDto, @Req() req: Request) { return this.attendance.updateSettings(actor, dto, req.ip); }

  @Get('admin/today')
  adminToday(@CurrentUser() actor: SessionUser) { return this.attendance.adminToday(actor); }

  @Get('admin/list')
  adminList(@CurrentUser() actor: SessionUser, @Query() query: AdminAttendanceListDto) { return this.attendance.adminList(actor, query); }

  @Get('admin/employees/:id')
  employeeProfile(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Query() query: AttendanceMonthQueryDto) { return this.attendance.employeeProfile(actor, id, query.month, query.year); }
}
