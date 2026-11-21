
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';

import { User } from '../users/user.entity';

import {
  SupportTicket,
  SupportTicketPriority,
  SupportTicketStatus,
} from './support-ticket.entity';

import { SupportTicketMessage } from './support-ticket-message.entity';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';
import { paginate } from '../common/pagination';

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,

    @InjectRepository(SupportTicketMessage)
    private readonly messageRepository: Repository<SupportTicketMessage>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationsService: NotificationsService,
  ) {}

  private isAdmin(role: string): boolean {
    return role === 'admin' || role === 'super_admin';
  }

  // Notifications are written with the caller's transaction manager (SEC-14).
  private async notifyAdmins(
    manager: EntityManager,
    ticket: SupportTicket,
    title: string,
    message: string,
  ) {
    const admins = await manager.getRepository(User).find({
      where: [{ role: 'admin' }, { role: 'super_admin' }],
    });

    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.createNotification(
          admin.id,
          title,
          message,
          'support_ticket',
          null,
          manager,
          ticket.id,
        ),
      ),
    );
  }

  private async notifyEmployee(
    manager: EntityManager,
    ticket: SupportTicket,
    title: string,
    message: string,
  ) {
    await this.notificationsService.createNotification(
      ticket.createdBy.id,
      title,
      message,
      'support_ticket',
      null,
      manager,
      ticket.id,
    );
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

    // Ticket, its number and the admin notifications commit or roll back together (SEC-14).
    const savedId = await this.ticketRepository.manager.transaction(
      async (manager) => {
        const ticketRepository = manager.getRepository(SupportTicket);

        const savedTicket = await ticketRepository.save(ticket);

        // Generate the permanent ticket number after the database assigns its ID.
        savedTicket.ticketNumber =
          `IT-${new Date().getFullYear()}-${String(savedTicket.id).padStart(4, '0')}`;

        await ticketRepository.save(savedTicket);

        await this.notifyAdmins(
          manager,
          savedTicket,
          'New IT Support Ticket',
          `${user.name} submitted ticket ${savedTicket.ticketNumber}: ${subject}`,
        );

        return savedTicket.id;
      },
    );

    return this.findOne(savedId, userId, false);
  }

  // The assigned admin comes back as id + name only (SEC-13).
  async findMyTickets(userId: number, query: TicketQueryDto) {
    const tickets = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoin('ticket.assignedTo', 'assignedTo')
      .addSelect(['assignedTo.id', 'assignedTo.name'])
      .where('createdBy.id = :userId', { userId });

    return this.page(tickets, query);
  }

  async findAll(query: TicketQueryDto) {
    const tickets = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoinAndSelect('ticket.assignedTo', 'assignedTo');

    return this.page(tickets, query);
  }

  // Status and priority filters, search, sort and one page.
  private page(
    tickets: SelectQueryBuilder<SupportTicket>,
    query: TicketQueryDto,
  ) {
    if (query.status) {
      tickets.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.priority) {
      tickets.andWhere('ticket.priority = :priority', {
        priority: query.priority,
      });
    }

    if (query.search) {
      tickets.andWhere(
        '(ticket.ticketNumber LIKE :search OR ticket.subject LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    return paginate(tickets, query, `ticket.${query.sort}`);
  }

  // Employees never receive internal notes (SEC-06) and see staff as id + name only (SEC-13).
  async findOne(ticketId: number, userId: number, admin: boolean) {
    const staff = (alias: string) =>
      admin ? [alias] : [`${alias}.id`, `${alias}.name`];

    const ticket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.createdBy', 'createdBy')
      .leftJoin('ticket.assignedTo', 'assignedTo')
      .addSelect(staff('assignedTo'))
      .leftJoinAndSelect(
        'ticket.messages',
        'message',
        admin ? undefined : 'message.isInternalNote = :internal',
        { internal: false },
      )
      .leftJoin('message.sender', 'sender')
      .addSelect(staff('sender'))
      .where('ticket.id = :ticketId', { ticketId })
      .orderBy('message.createdAt', 'ASC')
      .getOne();

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

    // Message, status change and notifications commit or roll back together (SEC-14).
    await this.ticketRepository.manager.transaction(async (manager) => {
      const ticketRepository = manager.getRepository(SupportTicket);

      await manager.getRepository(SupportTicketMessage).save(newMessage);

      if (admin) {
        await this.notifyEmployee(
          manager,
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

          await ticketRepository.save(ticket);
        } else if (
          ticket.status === SupportTicketStatus.WAITING_FOR_EMPLOYEE
        ) {
          ticket.status = SupportTicketStatus.IN_PROGRESS;

          await ticketRepository.save(ticket);
        }

        await this.notifyAdmins(
          manager,
          ticket,
          'New Employee Reply',
          `${sender.name} replied to ticket ${ticket.ticketNumber}.`,
        );
      }
    });

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

    // Status change and employee notification commit or roll back together (SEC-14).
    await this.ticketRepository.manager.transaction(async (manager) => {
      await manager.getRepository(SupportTicket).save(ticket);

      await this.notifyEmployee(
        manager,
        ticket,
        'Ticket Status Updated',
        `Your ticket ${ticket.ticketNumber} status is now: ${newStatus.replace(/_/g, ' ')}.`,
      );
    });

    return this.findOne(ticketId, adminId, true);
  }
}
