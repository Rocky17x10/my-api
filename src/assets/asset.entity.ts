
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'asset_tag',
    type: 'varchar',
    length: 50,
    unique: true,
  })
  assetTag: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({
    name: 'serial_number',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  serialNumber: string | null;

  @Column({
    type: 'enum',
    enum: ['available', 'assigned', 'maintenance', 'retired'],
    default: 'available',
  })
  status: 'available' | 'assigned' | 'maintenance' | 'retired';

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string | null;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
