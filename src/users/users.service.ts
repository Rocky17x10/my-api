
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  // Find a user by email for authentication
  
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
  async create(
    name: string,
    email: string,
    password: string,
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = this.usersRepository.create({
      name,
      email,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    // Never return the password hash in the API response.
    const { password: _password, ...safeUser } = savedUser;

    return safeUser as User;
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
