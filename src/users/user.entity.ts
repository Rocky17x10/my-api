
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

export type UserRole = 'super_admin' | 'admin' | 'user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 150, unique: true })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    select: false,
    nullable: true,
  })
  password: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  department: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  designation: string | null;

  @Column({
    type: 'enum',
    enum: ['super_admin', 'admin', 'user'],
    default: 'user',
  })
  role: UserRole;
}
