
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
import { AssetAssignmentHistory } from './asset-assignment-history.entity';
import { User } from '../users/user.entity';

export type AssetReturnStatus =
  | 'pending'
  | 'approved'
  | 'rejected';

export type AssetReturnCondition =
  | 'good'
  | 'damaged'
  | 'needs_maintenance';

@Entity('asset_returns')
@Index('IDX_asset_returns_asset', ['asset'])
@Index('IDX_asset_returns_assignment', ['assignmentHistory'])
@Index('IDX_asset_returns_employee', ['requestedBy'])
@Index('IDX_asset_returns_reviewer', ['reviewedBy'])
@Index('IDX_asset_returns_status', ['status'])
export class AssetReturn {
  @PrimaryGeneratedColumn()
  id: number;

  // Asset being returned
  @ManyToOne(() => Asset, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  // Original assignment record
  @ManyToOne(() => AssetAssignmentHistory, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_history_id' })
  assignmentHistory: AssetAssignmentHistory;

  // Employee requesting the return
  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'requested_by' })
  requestedBy: User;

  // Administrator reviewing the return
  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'reviewed_by' })
  reviewedBy: User | null;

  // Return request status
  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: AssetReturnStatus;

  // Physical equipment condition
  @Column({
    type: 'enum',
    enum: ['good', 'damaged', 'needs_maintenance'],
    nullable: true,
  })
  condition: AssetReturnCondition | null;

  // Employee's return reason
  @Column({
    name: 'employee_note',
    type: 'text',
    nullable: true,
  })
  employeeNote: string | null;

  // Administrator's inspection notes
  @Column({
    name: 'admin_note',
    type: 'text',
    nullable: true,
  })
  adminNote: string | null;

  // Request submission date
  @CreateDateColumn({
    name: 'requested_at',
    type: 'datetime',
  })
  requestedAt: Date;

  // Administrator review date
  @Column({
    name: 'reviewed_at',
    type: 'datetime',
    nullable: true,
  })
  reviewedAt: Date | null;

  // Actual return confirmation date
  @Column({
    name: 'confirmed_at',
    type: 'datetime',
    nullable: true,
  })
  confirmedAt: Date | null;
}
