
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { User } from '../users/user.entity';

@Entity('activity_logs')
@Index('IDX_activity_logs_entity', ['entityType', 'entityId'])
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  @Column({
    type: 'varchar',
    length: 100,
  })
  action: string;

  @Column({
    name: 'entity_type',
    type: 'varchar',
    length: 100,
  })
  entityType: string;

  @Column({
    name: 'entity_id',
    type: 'int',
    nullable: true,
  })
  entityId: number | null;

  @Column({
    type: 'text',
  })
  description: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  metadata: Record<string, any> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt: Date;
}
