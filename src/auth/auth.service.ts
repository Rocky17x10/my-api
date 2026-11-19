
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
      },
    };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    if (
      typeof currentPassword !== 'string' ||
      currentPassword.length === 0
    ) {
      throw new BadRequestException(
        'Current password is required.',
      );
    }

    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      newPassword.length > 72
    ) {
      throw new BadRequestException(
        'New password must be between 8 and 72 characters.',
      );
    }

    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(
        newPassword,
      )
    ) {
      throw new BadRequestException(
        'New password must contain uppercase, lowercase, number and special character.',
      );
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from current password.',
      );
    }

    const user = await this.usersService.findByIdWithPassword(
      userId,
    );

    if (!user || !user.password) {
      throw new UnauthorizedException(
        'Unable to verify current password.',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Current password is incorrect.',
      );
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      12,
    );

    await this.usersService.updatePassword(
      userId,
      hashedPassword,
    );

    await this.usersService.logPasswordChange(userId);

    return {
      message: 'Password changed successfully.',
    };
  }
}
