
import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';

import type { Request } from 'express';

import { UsersService } from './users.service';
import { User } from './user.entity';
import type { UserRole } from './user.entity';

import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    role: UserRole;
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // GET /users
  @Get()
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  // GET /users/:id
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<User> {
    return this.usersService.findOne(id);
  }

  // POST /users
  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<User> {
    return this.usersService.create(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
      createUserDto.department,
      createUserDto.designation,
      req.user.userId,
    );
  }

  // PATCH /users/:id
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<User> {
    if (
      updateUserDto.name === undefined &&
      updateUserDto.email === undefined &&
      updateUserDto.department === undefined &&
      updateUserDto.designation === undefined
    ) {
      throw new BadRequestException(
        'Provide at least one field to update',
      );
    }

    return this.usersService.update(
      id,
      updateUserDto.name,
      updateUserDto.email,
      updateUserDto.department,
      updateUserDto.designation,
      req.user.userId,
    );
  }

  // PATCH /users/:id/role
  // Only Super Admin can promote or demote accounts
  @Patch(':id/role')
  @Roles('super_admin')
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<User> {
    if (role !== 'admin' && role !== 'user') {
      throw new BadRequestException(
        'Role must be either admin or user.',
      );
    }

    return this.usersService.changeRole(
      id,
      role as UserRole,
      req.user.userId,
    );
  }

  // DELETE /users/:id
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ message: string }> {
    return this.usersService.remove(
      id,
      req.user.userId,
    );
  }
}
