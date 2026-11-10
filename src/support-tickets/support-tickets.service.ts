
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { User } from '../users/user.entity';

import {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from './support-ticket.entity';

import { SupportTicketMessage } from './support-ticket-message.entity';
import { Notification } from './notification.entity';

import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,

    @InjectRepository(SupportTicketMessage)
    private readonly messageRepository: Repository<SupportTicketMessage>,

    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private isAdmin(role: string): boolean {
    return role === 'admin' || role === 'super_admin';
  }

  private async notifyAdmins(
    ticket: SupportTicket,
    title: string,
    message: string,
  ) {
    const admins = await this.userRepository.find({
      where: [{ role: 'admin' }, { role: 'super_admin' }],
    });

    if (!admins.length) return;

    const notifications = admins.map((admin) =>
      this.notificationRepository.create({
        recipient: admin,
        ticket,
        title,
        message,
        type: 'support_ticket',
      }),
    );

    await this.notificationRepository.save(notifications);
  }

  private async notifyEmployee(
    ticket: SupportTicket,
    title: string,
    message: string,
  ) {
    const notification = this.notificationRepository.create({
      recipient: ticket.createdBy,
      ticket,
      title,
      message,
      type: 'support_ticket',
    });

    await this.notificationRepository.save(notification);
  }

  async create(userId: number, data: CreateSupportTicketDto) {
    const subject = data.subject?.trim();
    const category = data.category?.trim();
    const description = data.description?.trim();

    if (!subject || !category || !description) {
      throw new BadRequestException(
        'Subject, category and description are required.',
      );
    }

    if (subject.length > 200 || category.length > 100) {
      throw new BadRequestException(
        'Subject or category exceeds the allowed length.',
      );
    }

    if (description.length < 10 || description.length > 5000) {
      throw new BadRequestException(
        'Description must contain between 10 and 5000 characters.',
      );
    }

    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    // Short temporary number fits the database VARCHAR(30) column.
    const ticket = this.ticketRepository.create({
      ticketNumber: `TMP-${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      subject,
      category,
      description,
      priority: data.priority ?? SupportTicketPriority.MEDIUM,
      status: SupportTicketStatus.OPEN,
      createdBy: user,
    });

    const savedTicket = await this.ticketRepository.save(ticket);

    // Generate the permanent ticket number after the database assigns its ID.
    savedTicket.ticketNumber =
      `IT-${new Date().getFullYear()}-${String(savedTicket.id).padStart(4, '0')}`;

    await this.ticketRepository.save(savedTicket);

    await this.notifyAdmins(
      savedTicket,
      'New IT Support Ticket',
      `${user.name} submitted ticket ${savedTicket.ticketNumber}: ${subject}`,
    );

    return this.findOne(savedTicket.id, userId, false);
  }

  async findMyTickets(userId: number) {
    return this.ticketRepository.find({
      where: { createdBy: { id: userId } },
      relations: { createdBy: true, assignedTo: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll() {
    return this.ticketRepository.find({
      relations: { createdBy: true, assignedTo: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(ticketId: number, userId: number, admin: boolean) {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: {
        createdBy: true,
        assignedTo: true,
        messages: { sender: true },
      },
      order: { messages: { createdAt: 'ASC' } },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (!admin && ticket.createdBy.id !== userId) {
      throw new ForbiddenException(
        'You are not allowed to view this ticket.',
      );
    }

    return ticket;
  }

  async addMessage(
    ticketId: number,
    senderId: number,
    messageText: string,
    admin: boolean,
  ) {
    const message = messageText?.trim();

    if (!message || message.length > 5000) {
      throw new BadRequestException(
        'Message is required and cannot exceed 5000 characters.',
      );
    }

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: { createdBy: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (!admin && ticket.createdBy.id !== senderId) {
      throw new ForbiddenException(
        'You cannot reply to another employee ticket.',
      );
    }

    const sender = await this.userRepository.findOneBy({
      id: senderId,
    });

    if (!sender) {
      throw new NotFoundException('Sender not found.');
    }

    const newMessage = this.messageRepository.create({
      ticket,
      sender,
      message,
      isInternalNote: false,
    });

    await this.messageRepository.save(newMessage);

    if (admin) {
      await this.notifyEmployee(
        ticket,
        'Admin Replied to Your Ticket',
        `Admin replied to ticket ${ticket.ticketNumber}.`,
      );
    } else {
      if (
        ticket.status === SupportTicketStatus.RESOLVED ||
        ticket.status === SupportTicketStatus.CLOSED
      ) {
        ticket.status = SupportTicketStatus.REOPENED;
        ticket.resolvedAt = null;
        ticket.closedAt = null;

        await this.ticketRepository.save(ticket);
      } else if (
        ticket.status === SupportTicketStatus.WAITING_FOR_EMPLOYEE
      ) {
        ticket.status = SupportTicketStatus.IN_PROGRESS;

        await this.ticketRepository.save(ticket);
      }

      await this.notifyAdmins(
        ticket,
        'New Employee Reply',
        `${sender.name} replied to ticket ${ticket.ticketNumber}.`,
      );
    }

    return this.findOne(ticketId, senderId, admin);
  }

  async updateStatus(
    ticketId: number,
    adminId: number,
    newStatus: SupportTicketStatus,
  ) {
    if (!Object.values(SupportTicketStatus).includes(newStatus)) {
      throw new BadRequestException('Invalid ticket status.');
    }

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: { createdBy: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const admin = await this.userRepository.findOneBy({
      id: adminId,
    });

    if (!admin || !this.isAdmin(admin.role)) {
      throw new ForbiddenException(
        'Only Admin or Super Admin can update ticket status.',
      );
    }

    ticket.status = newStatus;

    if (newStatus === SupportTicketStatus.RESOLVED) {
      ticket.resolvedAt = new Date();
      ticket.closedAt = null;
    } else if (newStatus === SupportTicketStatus.CLOSED) {
      ticket.closedAt = new Date();

      if (!ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
    } else {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
    }

    await this.ticketRepository.save(ticket);

    await this.notifyEmployee(
      ticket,
      'Ticket Status Updated',
      `Your ticket ${ticket.ticketNumber} status is now: ${newStatus.replace(/_/g, ' ')}.`,
    );

    return this.findOne(ticketId, adminId, true);
  }
}
