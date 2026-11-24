
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { Notification } from './notification.entity';
import { User } from '../users/user.entity';
import { paginate } from '../common/pagination';
import { NotificationQueryDto } from './notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  // Create a notification for a specific user.
  // referenceId is optional and is used for linked records such as asset requests.
  // Pass the caller's transaction manager so the notification commits or rolls back with it.
  // ticketId links support-ticket notifications; findMyNotifications returns that relation.
  async createNotification(
    recipientId: number,
    title: string,
    message: string,
    type: string,
    referenceId?: number | null,
    manager?: EntityManager,
    ticketId?: number | null,
  ) {
    const repository = manager
      ? manager.getRepository(Notification)
      : this.notificationRepository;
    const notification = repository.create({
      recipient: { id: recipientId } as User,
      ticket: ticketId ? { id: ticketId } : null,
      referenceId: referenceId ?? null,
      title,
      message,
      type,
      isRead: false,
    });

    return repository.save(notification);
  }

  // Get the logged-in user's notifications.
  async findMyNotifications(userId: number, query: NotificationQueryDto) {
    const notifications = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.ticket', 'ticket')
      .where('notification.recipient = :userId', { userId });

    if (query.unread) {
      notifications.andWhere('notification.isRead = :isRead', { isRead: false });
    }

    return paginate(notifications, query, 'notification.createdAt');
  }

  // Get unread notification count.
  async getUnreadCount(userId: number) {
    const count = await this.notificationRepository.count({
      where: {
        recipient: { id: userId },
        isRead: false,
      },
    });

    return { count };
  }

  // Mark one notification as read.
  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.notificationRepository.findOne({
      where: {
        id: notificationId,
        recipient: { id: userId },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    notification.isRead = true;

    return this.notificationRepository.save(notification);
  }

  // Mark all notifications as read.
  async markAllAsRead(userId: number) {
    const notifications = await this.notificationRepository.find({
      where: {
        recipient: { id: userId },
        isRead: false,
      },
    });

    if (notifications.length > 0) {
      notifications.forEach((notification) => {
        notification.isRead = true;
      });

      await this.notificationRepository.save(notifications);
    }

    return {
      message: 'All notifications marked as read.',
      updated: notifications.length,
    };
  }
}
