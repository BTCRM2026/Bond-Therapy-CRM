import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CreateHrLetterDto, HrLetterActionDto, ListHrLettersDto } from './dto.js';
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

  @Get('options')
  options(@CurrentUser() actor: SessionUser) {
    return this.letters.options(actor);
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

  @Patch(':id/submit') submit(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.submit(actor, id, dto, req.ip); }
  @Patch(':id/approve') approve(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.approve(actor, id, dto, req.ip); }
  @Patch(':id/reject') reject(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.reject(actor, id, dto, req.ip); }
  @Patch(':id/generate') generate(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.generate(actor, id, dto, req.ip); }
  @Patch(':id/sent') sent(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.markSent(actor, id, dto, req.ip); }
  @Patch(':id/acknowledge') acknowledge(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.acknowledge(actor, id, dto, req.ip); }
  @Patch(':id/cancel') cancel(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.cancel(actor, id, dto, req.ip); }
  @Patch(':id/supersede') supersede(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: HrLetterActionDto, @Req() req: Request) { return this.letters.supersede(actor, id, dto, req.ip); }
  @Patch(':id') update(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: CreateHrLetterDto, @Req() req: Request) { return this.letters.update(actor, id, dto, req.ip); }

  @Delete(':id') remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.letters.remove(actor, id, req.ip); }

  @Get(':id/pdf')
  async pdf(
    @CurrentUser() actor: SessionUser,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Query('preview') preview: string | undefined,
    @Res() response: Response,
  ) {
    const { filename, buffer } = await this.letters.pdf(actor, id, preview === '1');
    response.setHeader('content-type', 'application/pdf');
    response.setHeader(
      'content-disposition',
      `${download === '1' ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    response.setHeader('cache-control', 'private, no-store');
    response.send(buffer);
  }
}

@Controller('verify')
export class LetterVerificationController {
  constructor(private readonly letters: LettersService) {}

  @Get(':token') verify(@Param('token') token: string) {
    return this.letters.verify(token);
  }
}
