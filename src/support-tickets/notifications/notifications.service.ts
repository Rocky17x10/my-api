
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification } from '../notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  // Get the logged-in user's notifications
  async findMyNotifications(userId: number) {
    return this.notificationRepository.find({
      where: {
        recipient: { id: userId },
      },
      relations: {
        ticket: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 30,
    });
  }

  // Get unread notification count
  async getUnreadCount(userId: number) {
    const count = await this.notificationRepository.count({
      where: {
        recipient: { id: userId },
        isRead: false,
      },
    });

    return { count };
  }

  // Mark one notification as read
  async markAsRead(
    notificationId: number,
    userId: number,
  ) {
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

  // Mark all notifications as read
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
