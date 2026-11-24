
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
  Query,
  UseGuards,
} from '@nestjs/common';

import { UsersService } from './users.service';
import { User } from './user.entity';

import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { UserListQueryDto } from './dto/user-list-query.dto';
import type { Page } from '../common/pagination';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // GET /users
  @Get()
  findAll(@Query() query: UserListQueryDto): Promise<Page<User>> {
    return this.usersService.findAll(query);
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
    @CurrentUser() user: AuthUser,
  ): Promise<User> {
    return this.usersService.create(
      createUserDto.name,
      createUserDto.email,
      createUserDto.password,
      createUserDto.department,
      createUserDto.designation,
      user.userId,
    );
  }

  // PATCH /users/:id
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
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
      user,
    );
  }

  // PATCH /users/:id/role
  // Only Super Admin can promote or demote accounts
  @Patch(':id/role')
  @Roles('super_admin')
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<User> {
    return this.usersService.changeRole(
      id,
      dto.role,
      user.userId,
    );
  }

  // DELETE /users/:id
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<{ message: string }> {
    return this.usersService.remove(
      id,
      user,
    );
  }
}
