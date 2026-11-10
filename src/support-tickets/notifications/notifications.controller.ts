
import {
  Controller,
  Get,
  Patch,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

type AuthenticatedRequest = {
  user: {
    userId: number;
  };
};

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
  ) {}

  // Get logged-in user's notifications
  @Get()
  async findMyNotifications(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.findMyNotifications(
      req.user.userId,
    );
  }

  // Get unread notification count
  @Get('unread-count')
  async getUnreadCount(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.getUnreadCount(
      req.user.userId,
    );
  }

  // Mark all notifications as read
  @Patch('read-all')
  async markAllAsRead(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAllAsRead(
      req.user.userId,
    );
  }

  // Mark one notification as read
  @Patch(':id/read')
  async markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.notificationsService.markAsRead(
      id,
      req.user.userId,
    );
  }
}
