import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SessionGuard } from '../common/session.guard.js';
import { RolesGuard } from '../common/roles.guard.js';
import { Roles } from '../common/roles.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { SessionUser } from '../common/session.util.js';
import { DistributorsService } from './distributors.service.js';
import { CreateDistributorDto, CreateDistributorUserDto, UpdateDistributorDto, UpdateDistributorUserStatusDto } from './dto.js';

@Controller('distributors')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class DistributorsController {
  constructor(private readonly distributors: DistributorsService) {}

  @Get()
  list() {
    return this.distributors.list();
  }

  @Post()
  create(@Body() dto: CreateDistributorDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.distributors.create(dto, actor, req.ip);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDistributorDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.distributors.update(id, dto, actor, req.ip);
  }

  @Get(':id/users')
  listUsers(@Param('id') id: string) {
    return this.distributors.listUsers(id);
  }

  @Post(':id/users')
  createUser(@Param('id') id: string, @Body() dto: CreateDistributorUserDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.distributors.createUser(id, dto, actor, req.ip);
  }

  @Patch(':id/users/:userId/status')
  updateUserStatus(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateDistributorUserStatusDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.distributors.updateUserStatus(id, userId, dto, actor, req.ip);
  }
}
