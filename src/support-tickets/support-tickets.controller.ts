
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import { SupportTicketsService } from './support-tickets.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';

import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportTicketsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
  ) {}

  // Create a new support ticket
  @Post()
  @AnyRole()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() data: CreateSupportTicketDto,
  ) {
    return this.supportTicketsService.create(
      user.userId,
      data,
    );
  }

  // Employee: View own tickets
  @Get('my')
  @AnyRole()
  async findMyTickets(
    @CurrentUser() user: AuthUser,
    @Query() query: TicketQueryDto,
  ) {
    return this.supportTicketsService.findMyTickets(
      user.userId,
      query,
    );
  }

  // Admin and Super Admin: View all tickets
  @Get()
  @Roles('admin', 'super_admin')
  async findAll(@Query() query: TicketQueryDto) {
    return this.supportTicketsService.findAll(query);
  }

  // View one ticket (owner or admin)
  @Get(':id')
  @AnyRole()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    const isAdmin =
      user.role === 'admin' ||
      user.role === 'super_admin';

    return this.supportTicketsService.findOne(
      id,
      user.userId,
      isAdmin,
    );
  }

  // Employee or Admin: Add a reply
  @Post(':id/messages')
  @AnyRole()
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() data: AddTicketMessageDto,
  ) {
    const isAdmin =
      user.role === 'admin' ||
      user.role === 'super_admin';

    return this.supportTicketsService.addMessage(
      id,
      user.userId,
      data.message,
      isAdmin,
      data.isInternalNote === true,
    );
  }

  // Admin and Super Admin: Update ticket status
  @Patch(':id/status')
  @Roles('admin', 'super_admin')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() data: UpdateTicketStatusDto,
  ) {
    return this.supportTicketsService.updateStatus(
      id,
      user.userId,
      data.status,
    );
  }
}
