import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { Roles } from '../common/roles.decorator.js';
import { RolesGuard } from '../common/roles.guard.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CreateHrLetterDto, ListHrLettersDto } from './dto.js';
import { LettersService } from './letters.service.js';

@Controller('letters')
@UseGuards(SessionGuard, PortalGuard, RolesGuard)
@Portals(PortalType.ADMIN)
@Roles('SUPER_ADMIN')
export class LettersController {
  constructor(private readonly letters: LettersService) {}

  @Get()
  list(@CurrentUser() actor: SessionUser, @Query() query: ListHrLettersDto) {
    return this.letters.list(actor, query);
  }

  @Post()
  create(
    @CurrentUser() actor: SessionUser,
    @Body() dto: CreateHrLetterDto,
    @Req() req: Request,
  ) {
    return this.letters.create(actor, dto, req.ip);
  }

  @Get(':id')
  detail(@CurrentUser() actor: SessionUser, @Param('id') id: string) {
    return this.letters.detail(actor, id);
  }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() response: Response,
  ) {
    const { filename, buffer } = await this.letters.pdf(actor, id);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader(
      'content-disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    response.setHeader('cache-control', 'private, no-store');
    response.send(buffer);
  }
}
