
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
    department?: string,
    designation?: string,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.usersRepository.create({
      name,
      email,
      password: hashedPassword,
      department: department || null,
      designation: designation || null,
    });

    const savedUser = await this.usersRepository.save(user);

    const { password: _password, ...safeUser } = savedUser;

    return safeUser as User;
  }

  // PATCH /users/:id
  async update(
    id: number,
    name?: string,
    email?: string,
    department?: string,
    designation?: string,
  ): Promise<User> {
    const user = await this.findOne(id);

    // Protect the Super Admin account
    if (user.role === 'super_admin') {
      throw new ForbiddenException(
        'The Super Admin account cannot be modified.',
      );
    }

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

    return this.usersRepository.save(user);
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

    user.role = role;

    return this.usersRepository.save(user);
  }

  // DELETE /users/:id
  async remove(id: number): Promise<{ message: string }> {
    const user = await this.findOne(id);

    // Never allow deletion of the Super Admin account
    if (user.role === 'super_admin') {
      throw new ForbiddenException(
        'The Super Admin account cannot be deleted.',
      );
    }

    await this.usersRepository.remove(user);

    return { message: 'User deleted successfully' };
  }
}
