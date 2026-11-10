
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { SupportTicketsService } from './support-tickets.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { AddTicketMessageDto } from './dto/add-ticket-message.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

type AuthenticatedRequest = {
  user: {
    userId: number;
    email: string;
    role: UserRole;
  };
};

@Controller('support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportTicketsController {
  constructor(
    private readonly supportTicketsService: SupportTicketsService,
  ) {}

  // Create a new support ticket
  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() data: CreateSupportTicketDto,
  ) {
    return this.supportTicketsService.create(
      req.user.userId,
      data,
    );
  }

  // Employee: View own tickets
  @Get('my')
  async findMyTickets(
    @Req() req: AuthenticatedRequest,
  ) {
    return this.supportTicketsService.findMyTickets(
      req.user.userId,
    );
  }

  // Admin and Super Admin: View all tickets
  @Get()
  @Roles('admin', 'super_admin')
  async findAll() {
    return this.supportTicketsService.findAll();
  }

  // View one ticket (owner or admin)
  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const isAdmin =
      req.user.role === 'admin' ||
      req.user.role === 'super_admin';

    return this.supportTicketsService.findOne(
      id,
      req.user.userId,
      isAdmin,
    );
  }

  // Employee or Admin: Add a reply
  @Post(':id/messages')
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() data: AddTicketMessageDto,
  ) {
    const isAdmin =
      req.user.role === 'admin' ||
      req.user.role === 'super_admin';

    return this.supportTicketsService.addMessage(
      id,
      req.user.userId,
      data.message,
      isAdmin,
    );
  }

  // Admin and Super Admin: Update ticket status
  @Patch(':id/status')
  @Roles('admin', 'super_admin')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() data: UpdateTicketStatusDto,
  ) {
    return this.supportTicketsService.updateStatus(
      id,
      req.user.userId,
      data.status,
    );
  }
}
