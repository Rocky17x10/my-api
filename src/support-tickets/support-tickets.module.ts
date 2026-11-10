
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportTicket } from './support-ticket.entity';
import { SupportTicketMessage } from './support-ticket-message.entity';
import { Notification } from './notification.entity';
import { User } from '../users/user.entity';

import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';

import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupportTicket,
      SupportTicketMessage,
      Notification,
      User,
    ]),
  ],

  controllers: [
    SupportTicketsController,
    NotificationsController,
  ],

  providers: [
    SupportTicketsService,
    NotificationsService,
    JwtAuthGuard,
    RolesGuard,
  ],

  exports: [
    SupportTicketsService,
    NotificationsService,
  ],
})
export class SupportTicketsModule {}
