import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateLeaveDto, LeaveListDto, LeaveMonthDto, LeaveRangeDto, ReviewLeaveDto } from './dto.js';
import { LeaveService } from './leave.service.js';

@Controller('leave')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  // Staff
  @Get('summary')
  summary(@CurrentUser() actor: SessionUser, @Query() query: LeaveMonthDto) { return this.leave.summary(actor, query.month); }

  @Get('preview')
  preview(@CurrentUser() actor: SessionUser, @Query() query: LeaveRangeDto) { return this.leave.preview(actor, query); }

  @Get('mine')
  mine(@CurrentUser() actor: SessionUser) { return this.leave.mine(actor); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateLeaveDto, @Req() req: Request) { return this.leave.create(actor, dto, req.ip); }

  // Admin (and sales managers for their own team)
  @Get('requests')
  requests(@CurrentUser() actor: SessionUser, @Query() query: LeaveListDto) { return this.leave.listForReview(actor, query.status); }

  @Get('report')
  report(@CurrentUser() actor: SessionUser, @Query() query: LeaveMonthDto) { return this.leave.report(actor, query.month); }

  @Post(':id/review')
  review(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReviewLeaveDto, @Req() req: Request) { return this.leave.review(actor, id, dto, req.ip); }

  @Delete(':id')
  cancel(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.leave.cancel(actor, id, req.ip); }
}
