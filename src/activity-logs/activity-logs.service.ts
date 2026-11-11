
import {
  Injectable,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActivityLog } from './activity-log.entity';
import { User } from '../users/user.entity';

export interface CreateActivityLogData {
  actorId: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  description: string;
  metadata?: Record<string, any> | null;
}

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogsRepository: Repository<ActivityLog>,
  ) {}

  // Record an activity
  async createLog(data: CreateActivityLogData) {
    const log = this.activityLogsRepository.create({
      actor: data.actorId
        ? ({ id: data.actorId } as User)
        : null,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId ?? null,
      description: data.description,
      metadata: data.metadata ?? null,
    });

    return this.activityLogsRepository.save(log);
  }

  // Retrieve activity logs with optional filters
  async findAll(filters: {
    action?: string;
    entityType?: string;
    search?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(filters.limit) || 20),
    );

    const query = this.activityLogsRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.actor', 'actor')
      .orderBy('log.createdAt', 'DESC');

    if (filters.action) {
      query.andWhere('log.action = :action', {
        action: filters.action,
      });
    }

    if (filters.entityType) {
      query.andWhere('log.entityType = :entityType', {
        entityType: filters.entityType,
      });
    }

    if (filters.search) {
      query.andWhere(
        `(
          log.description LIKE :search
          OR log.action LIKE :search
          OR log.entityType LIKE :search
          OR actor.name LIKE :search
          OR actor.email LIKE :search
        )`,
        {
          search: `%${filters.search}%`,
        },
      );
    }

    if (filters.from) {
      query.andWhere('log.createdAt >= :fromDate', {
        fromDate: `${filters.from} 00:00:00`,
      });
    }

    if (filters.to) {
      query.andWhere('log.createdAt <= :toDate', {
        toDate: `${filters.to} 23:59:59.999999`,
      });
    }

    const total = await query.getCount();

    const logs = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
