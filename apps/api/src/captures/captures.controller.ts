import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PortalType } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { CAPTURE_PURPOSES, CapturesService, type CapturePurpose } from './captures.service.js';

export class IssueCaptureDto {
  @IsIn(CAPTURE_PURPOSES as unknown as string[]) purpose!: CapturePurpose;
  @IsOptional() @IsString() @MaxLength(60) scopeId?: string;
}

@Controller('captures')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class CapturesController {
  constructor(private readonly captures: CapturesService) {}

  @Post()
  issue(@CurrentUser() actor: SessionUser, @Body() dto: IssueCaptureDto) { return this.captures.issue(actor, dto.purpose, dto.scopeId); }
}
