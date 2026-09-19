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
import { UsersService } from './users.service.js';
import { CreateUserDto, UpdateUserDto } from './dto.js';

@Controller('users')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.users.create(dto, actor, req.ip);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.users.update(id, dto, actor, req.ip);
  }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.users.resetPassword(id, actor, req.ip);
  }
}
