import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../common/session.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { SessionUser } from '../common/session.util.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser) {
    return this.notifications.list(user);
  }

  // Declared before ':id' so "read-all" is not treated as a notification id.
  @Patch('read-all')
  markAllRead(@CurrentUser() user: SessionUser) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id')
  markRead(@Param('id') id: string, @CurrentUser() user: SessionUser) {
    return this.notifications.markRead(id, user);
  }
}
