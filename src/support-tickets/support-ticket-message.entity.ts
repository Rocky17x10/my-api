
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

@Entity('support_ticket_messages')
export class SupportTicketMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(
    () => SupportTicket,
    (ticket) => ticket.messages,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ type: 'text' })
  message: string;

  @Column({
    name: 'is_internal_note',
    type: 'boolean',
    default: false,
  })
  isInternalNote: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
  })
  createdAt: Date;
}
