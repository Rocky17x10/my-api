
import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';
import { NotificationQueryDto } from './notification-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // Get logged-in user's notifications
  @Get()
  async findMyNotifications(
    @CurrentUser() user: AuthUser,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findMyNotifications(
      user.userId,
      query,
    );
  }

  // Get unread notification count
  @Get('unread-count')
  async getUnreadCount(
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.getUnreadCount(
      user.userId,
    );
  }

  // Mark all notifications as read
  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markAllAsRead(
      user.userId,
    );
  }

  // Mark one notification as read
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notificationsService.markAsRead(
      id,
      user.userId,
    );
  }
}
