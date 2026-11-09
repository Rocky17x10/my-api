import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';

export type MaintenanceStatus = 'in_progress' | 'completed';

@Entity('maintenance_records')
export class Maintenance {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Asset, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'asset_id' })
  asset: Asset;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'completed_by' })
  completedBy: User | null;

  @Column({
    name: 'maintenance_type',
    type: 'varchar',
    length: 80,
  })
  maintenanceType: string;

  @Column({
    name: 'problem_description',
    type: 'text',
  })
  problemDescription: string;

  @Column({
    name: 'repair_details',
    type: 'text',
    nullable: true,
  })
  repairDetails: string | null;

  @Column({
    name: 'start_date',
    type: 'datetime',
  })
  startDate: Date;

  @Column({
    name: 'completion_date',
    type: 'datetime',
    nullable: true,
  })
  completionDate: Date | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  cost: number;

  @Column({
    name: 'service_provider',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  serviceProvider: string | null;

  @Column({
    type: 'enum',
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
  })
  status: MaintenanceStatus;

  @Column({
    name: 'admin_notes',
    type: 'text',
    nullable: true,
  })
  adminNotes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}