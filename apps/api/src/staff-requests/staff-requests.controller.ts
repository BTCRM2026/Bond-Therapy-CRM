import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateRequestDto, DecideRequestDto, ListRequestsDto, ReplyRequestDto } from './dto.js';
import { StaffRequestsService } from './staff-requests.service.js';

@Controller('requests')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class StaffRequestsController {
  constructor(private readonly requests: StaffRequestsService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListRequestsDto) { return this.requests.list(actor, query); }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.requests.detail(actor, id); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: CreateRequestDto, @Req() req: Request) { return this.requests.create(actor, dto, req.ip); }

  @Post(':id/decision')
  decide(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: DecideRequestDto, @Req() req: Request) { return this.requests.decide(actor, id, dto, req.ip); }

  @Post(':id/reply')
  reply(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ReplyRequestDto, @Req() req: Request) { return this.requests.reply(actor, id, dto.comment, req.ip); }
}
