
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // GET /users
  findAll(): Promise<User[]> {
    return this.usersRepository.find();
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
  create(name: string, email: string): Promise<User> {
    const user = this.usersRepository.create({ name, email });
    return this.usersRepository.save(user);
  }

  // PATCH /users/:id
  async update(
    id: number,
    name?: string,
    email?: string,
  ): Promise<User> {
    const user = await this.findOne(id);

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    return this.usersRepository.save(user);
  }

  // DELETE /users/:id
  async remove(id: number): Promise<{ message: string }> {
    const user = await this.findOne(id);

    await this.usersRepository.remove(user);

    return { message: 'User deleted successfully' };
  }
}
