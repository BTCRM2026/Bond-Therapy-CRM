import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { BeatDto, CityDto, RegionDto, StateDto, TerritoryDto } from './dto.js';
import { TerritoryService } from './territory.service.js';

@Controller('territory')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class TerritoryController {
  constructor(private readonly territory: TerritoryService) {}

  @Get('hierarchy')
  hierarchy(@CurrentUser() actor: SessionUser) { return this.territory.hierarchy(actor); }

  @Post('regions')
  createRegion(@CurrentUser() actor: SessionUser, @Body() dto: RegionDto, @Req() req: Request) { return this.territory.createRegion(actor, dto, req.ip); }

  @Patch('regions/:id')
  updateRegion(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: RegionDto, @Req() req: Request) { return this.territory.updateRegion(actor, id, dto, req.ip); }

  @Delete('regions/:id')
  deleteRegion(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.territory.deleteRegion(actor, id, req.ip); }

  @Post('states')
  createState(@CurrentUser() actor: SessionUser, @Body() dto: StateDto, @Req() req: Request) { return this.territory.createState(actor, dto, req.ip); }

  @Patch('states/:id')
  updateState(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: StateDto, @Req() req: Request) { return this.territory.updateState(actor, id, dto, req.ip); }

  @Delete('states/:id')
  deleteState(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.territory.deleteState(actor, id, req.ip); }

  @Post('cities')
  createCity(@CurrentUser() actor: SessionUser, @Body() dto: CityDto, @Req() req: Request) { return this.territory.createCity(actor, dto, req.ip); }

  @Patch('cities/:id')
  updateCity(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: CityDto, @Req() req: Request) { return this.territory.updateCity(actor, id, dto, req.ip); }

  @Delete('cities/:id')
  deleteCity(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.territory.deleteCity(actor, id, req.ip); }

  @Post('territories')
  createTerritory(@CurrentUser() actor: SessionUser, @Body() dto: TerritoryDto, @Req() req: Request) { return this.territory.createTerritory(actor, dto, req.ip); }

  @Patch('territories/:id')
  updateTerritory(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: TerritoryDto, @Req() req: Request) { return this.territory.updateTerritory(actor, id, dto, req.ip); }

  @Delete('territories/:id')
  deleteTerritory(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.territory.deleteTerritory(actor, id, req.ip); }

  @Post('beats')
  createBeat(@CurrentUser() actor: SessionUser, @Body() dto: BeatDto, @Req() req: Request) { return this.territory.createBeat(actor, dto, req.ip); }

  @Patch('beats/:id')
  updateBeat(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: BeatDto, @Req() req: Request) { return this.territory.updateBeat(actor, id, dto, req.ip); }

  @Delete('beats/:id')
  deleteBeat(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.territory.deleteBeat(actor, id, req.ip); }
}
