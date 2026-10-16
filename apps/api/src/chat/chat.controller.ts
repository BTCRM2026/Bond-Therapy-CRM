import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PortalType } from '@prisma/client';
import { CurrentUser } from '../common/current-user.decorator.js';
import { PortalGuard } from '../common/portal.guard.js';
import { Portals } from '../common/portals.decorator.js';
import { SessionGuard } from '../common/session.guard.js';
import type { SessionUser } from '../common/session.util.js';
import { SendMessageDto, StartDirectDto } from './dto.js';
import { ChatService } from './chat.service.js';

// Internal team chat: admin and staff portals only. Distributor partners are not part of it.
@Controller('chat')
@UseGuards(SessionGuard, PortalGuard)
@Portals(PortalType.ADMIN, PortalType.STAFF)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  conversations(@CurrentUser() actor: SessionUser) { return this.chat.conversations(actor); }

  @Get('summary')
  summary(@CurrentUser() actor: SessionUser) { return this.chat.summary(actor); }

  @Get('people')
  people(@CurrentUser() actor: SessionUser) { return this.chat.people(actor); }

  @Post('conversations/direct')
  startDirect(@CurrentUser() actor: SessionUser, @Body() dto: StartDirectDto) { return this.chat.startDirect(actor, dto.userId); }

  @Get('conversations/:id/messages')
  messages(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Query('before') before?: string) { return this.chat.messages(actor, id, before); }

  @Post('conversations/:id/messages')
  send(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Body() dto: SendMessageDto) { return this.chat.send(actor, id, dto.body); }

  @Delete('messages/:id')
  remove(@CurrentUser() actor: SessionUser, @Param('id') id: string, @Req() req: Request) { return this.chat.remove(actor, id, req.ip); }
}
