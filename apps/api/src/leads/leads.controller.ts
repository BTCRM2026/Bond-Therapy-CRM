import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { LeadDto, ListLeadsDto } from './dto.js';
import { LeadsService } from './leads.service.js';

@Controller('leads')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListLeadsDto) { return this.leads.list(actor, query); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: LeadDto, @Req() req: Request) { return this.leads.create(actor, dto, req.ip); }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: LeadDto, @Req() req: Request) { return this.leads.update(actor, id, dto, req.ip); }

  @Post(':id/convert')
  convert(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.leads.convert(actor, id, req.ip); }
}
