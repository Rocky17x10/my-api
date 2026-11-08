
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Asset } from './asset.entity';
import { User } from '../users/user.entity';

@Entity('asset_assignment_history')
@Index('IDX_assignment_history_asset', ['asset'])
@Index('IDX_assignment_history_employee', ['assignedTo'])
@Index('IDX_assignment_history_admin', ['assignedBy'])
export class AssetAssignmentHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Asset, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'assigned_by' })
  assignedBy: User | null;

  @CreateDateColumn({
    name: 'assigned_at',
    type: 'datetime',
  })
  assignedAt: Date;

  @Column({
    name: 'returned_at',
    type: 'datetime',
    nullable: true,
  })
  returnedAt: Date | null;
}
