
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from './user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ActivityLog } from '../activity-logs/activity-log.entity';
import { accountChangeDenied } from './account-rules';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,

    private readonly activityLogsService: ActivityLogsService,

    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  // Find a user by email for authentication
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  // GET /users
  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { id: 'DESC' },
    });
  }

  // Session checks: null instead of 404, so a deleted user gets 401.
  findById(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  /** mustChange: true when an admin chose the password (the user must replace it). */
  async setPassword(
    id: number,
    password: string,
    mustChange: boolean,
  ): Promise<void> {
    const hash = await bcrypt.hash(
      password,
      this.config.get('BCRYPT_SALT_ROUNDS', { infer: true }),
    );
    await this.usersRepository.update(id, {
      password: hash,
      mustChangePassword: mustChange,
    });
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await this.usersRepository.update(id, { isActive: active });
  }

  // GET /users/:id
  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // POST /users
  async create(
    name: string,
    email: string,
    password: string,
    department: string | undefined,
    designation: string | undefined,
    actorId: number,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(
      password,
      this.config.get('BCRYPT_SALT_ROUNDS', { infer: true }),
    );

    const user = this.usersRepository.create({
      name,
      email,
      password: hashedPassword,
      department: department || null,
      designation: designation || null,
      // The admin knows this password, so the employee must replace it (SEC-04).
      mustChangePassword: true,
    });

    const savedUser = await this.usersRepository.save(user);

    await this.activityLogsService.createLog({
      actorId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'employee',
      entityId: savedUser.id,
      description: `Employee ${savedUser.name} (${savedUser.email}) was created.`,
      metadata: {
        name: savedUser.name,
        email: savedUser.email,
        department: savedUser.department,
        designation: savedUser.designation,
        role: savedUser.role,
      },
    });

    const { password: _password, ...safeUser } = savedUser;

    return safeUser as User;
  }

  // PATCH /users/:id
  async update(
    id: number,
    name: string | undefined,
    email: string | undefined,
    department: string | undefined,
    designation: string | undefined,
    actor: { userId: number; role: UserRole },
  ): Promise<User> {
    const actorId = actor.userId;
    const user = await this.findOne(id);

    const denied = accountChangeDenied(actor, user);
    if (denied) {
      throw new ForbiddenException(denied);
    }

    const previousValues = {
      name: user.name,
      email: user.email,
      department: user.department,
      designation: user.designation,
    };

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    if (department !== undefined) {
      user.department = department || null;
    }

    if (designation !== undefined) {
      user.designation = designation || null;
    }

    const updatedUser = await this.usersRepository.save(user);

    await this.activityLogsService.createLog({
      actorId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'employee',
      entityId: updatedUser.id,
      description: `Employee ${updatedUser.name} (${updatedUser.email}) was updated.`,
      metadata: {
        previousValues,
        updatedValues: {
          name: updatedUser.name,
          email: updatedUser.email,
          department: updatedUser.department,
          designation: updatedUser.designation,
        },
      },
    });

    return updatedUser;
  }

  // PATCH /users/:id/role
  // Only Super Admin can change another account's role
  async changeRole(
    id: number,
    role: UserRole,
    actorId: number,
  ): Promise<User> {
    const user = await this.findOne(id);

    if (id === actorId) {
      throw new ForbiddenException(
        'You cannot change your own role.',
      );
    }

    if (user.role === 'super_admin') {
      throw new ForbiddenException(
        'The Super Admin role cannot be changed.',
      );
    }

    if (role !== 'admin' && role !== 'user') {
      throw new BadRequestException(
        'Role must be either admin or user.',
      );
    }

    const previousRole = user.role;

    user.role = role;

    const updatedUser = await this.usersRepository.save(user);

    await this.activityLogsService.createLog({
      actorId,
      action: 'EMPLOYEE_ROLE_CHANGED',
      entityType: 'employee',
      entityId: updatedUser.id,
      description: `The role of ${updatedUser.name} was changed from ${previousRole} to ${role}.`,
      metadata: {
        previousRole,
        newRole: role,
      },
    });

    return updatedUser;
  }

  // DELETE /users/:id
  async remove(
    id: number,
    actor: { userId: number; role: UserRole },
  ): Promise<{ message: string }> {
    const actorId = actor.userId;
    const user = await this.findOne(id);

    const denied = accountChangeDenied(actor, user);
    if (denied) {
      throw new ForbiddenException(denied);
    }

    // Deleting would blank the actor of their audit-log entries (FK SET NULL).
    const hasHistory = await this.usersRepository.manager.exists(ActivityLog, {
      where: { actor: { id: user.id } },
    });
    if (hasHistory) {
      throw new ConflictException(
        'This account has activity history and cannot be deleted. Deactivate it instead.',
      );
    }

    const deletedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      designation: user.designation,
      role: user.role,
    };

    await this.usersRepository.remove(user);

    await this.activityLogsService.createLog({
      actorId,
      action: 'EMPLOYEE_DELETED',
      entityType: 'employee',
      entityId: deletedUser.id,
      description: `Employee ${deletedUser.name} (${deletedUser.email}) was deleted.`,
      metadata: deletedUser,
    });

    return { message: 'User deleted successfully' };
  }
}
