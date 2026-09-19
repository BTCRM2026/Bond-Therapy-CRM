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
import { AgreementsService } from './agreements.service.js';
import { CreateAgreementDto, UpdateAgreementDto } from './dto.js';

@Controller('agreements')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class AgreementsController {
  constructor(private readonly agreements: AgreementsService) {}

  @Get()
  list() {
    return this.agreements.list();
  }

  @Post()
  create(@Body() dto: CreateAgreementDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.agreements.create(dto, actor, req.ip);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAgreementDto, @CurrentUser() actor: SessionUser, @Req() req: Request) {
    return this.agreements.update(id, dto, actor, req.ip);
  }
}
