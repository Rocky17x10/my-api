import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';

import { EnvironmentVariables } from '../config/env.validation';
import { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { ACCESS_COOKIE, readCookie } from './auth-cookies';

interface JwtPayload {
  sub: number;
}

/** What `req.user` holds on authenticated requests. */
export interface AuthUser {
  userId: number;
  email: string;
  name: string;
  role: UserRole;
  department: string | null;
  designation: string | null;
  mustChangePassword: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: (req: Request) => readCookie(req, ACCESS_COOKIE) ?? null,
      ignoreExpiration: false,
      algorithms: ['HS256'],
      secretOrKey: config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  // Reloads the user on every request, so deletions and role changes apply at once.
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user?.isActive) throw new UnauthorizedException();

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      designation: user.designation,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
