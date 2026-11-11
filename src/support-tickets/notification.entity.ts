
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '../users/user.entity';
import { SupportTicket } from './support-ticket.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @ManyToOne(() => SupportTicket, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket | null;

  // Stores the related asset request ID.
  // NULL for notifications that are not linked to an asset request.
  @Column({
    name: 'reference_id',
    type: 'int',
    nullable: true,
  })
  referenceId: number | null;

  @Column({
    type: 'varchar',
    length: 200,
  })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'support_ticket',
  })
  type: string;

  @Column({
    name: 'is_read',
    type: 'boolean',
    default: false,
  })
  isRead: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt: Date;
}
