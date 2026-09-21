import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { PortalType } from '@prisma/client';
import { ClientActivityDto, ClientDto, ListActivitiesDto, ListClientsDto, UpdateActivityStatusDto } from './dto.js';
import { ClientsService } from './clients.service.js';

@Controller('clients')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListClientsDto) { return this.clients.list(actor, query); }

  @Get('activities')
  listActivities(@CurrentUser() actor: SessionUser, @Query() query: ListActivitiesDto) { return this.clients.listActivities(actor, query); }

  @Patch('activities/:id')
  updateActivityStatus(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: UpdateActivityStatusDto) { return this.clients.updateActivityStatus(actor, id, dto); }

  @Get('territory')
  territoryCoverage(@CurrentUser() actor: SessionUser) { return this.clients.territoryCoverage(actor); }

  @Get('trainers')
  listTrainers(@CurrentUser() actor: SessionUser) { return this.clients.listTrainers(actor); }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) { return this.clients.detail(actor, id); }

  @Post()
  create(@CurrentUser() actor: SessionUser, @Body() dto: ClientDto, @Req() req: Request) { return this.clients.create(actor, dto, req.ip); }

  @Patch(':id')
  update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ClientDto, @Req() req: Request) { return this.clients.update(actor, id, dto, req.ip); }

  @Post(':id/activities')
  addActivity(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: ClientActivityDto, @Req() req: Request) { return this.clients.addActivity(actor, id, dto, req.ip); }
}
