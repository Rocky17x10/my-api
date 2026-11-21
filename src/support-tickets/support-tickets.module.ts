
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportTicket } from './support-ticket.entity';
import { SupportTicketMessage } from './support-ticket-message.entity';
import { User } from '../users/user.entity';

import { SupportTicketsController } from './support-tickets.controller';
import { SupportTicketsService } from './support-tickets.service';

import { NotificationsModule } from '../notifications/notifications.module';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      SupportTicket,
      SupportTicketMessage,
      User,
    ]),
  ],

  controllers: [
    SupportTicketsController,
  ],

  providers: [
    SupportTicketsService,
    JwtAuthGuard,
    RolesGuard,
  ],

  exports: [
    SupportTicketsService,
  ],
})
export class SupportTicketsModule {}
