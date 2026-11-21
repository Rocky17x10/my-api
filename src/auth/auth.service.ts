import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { EnvironmentVariables } from '../config/env.validation';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import type { AuthUser } from './jwt.strategy';
import {
  IssuedRefreshToken,
  RefreshTokensService,
} from './refresh-tokens.service';

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  department: string | null;
  designation: string | null;
  mustChangePassword: boolean;
}

/** Everything the controller needs to answer and set cookies. */
export interface Session {
  user: SessionUser;
  accessToken: string;
  refresh: IssuedRefreshToken;
}

const toSessionUser = (user: User): SessionUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  department: user.department,
  designation: user.designation,
  mustChangePassword: user.mustChangePassword,
});

@Injectable()
export class AuthService {
  // Compared when the email is unknown, so both answers cost one bcrypt (SEC-02).
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensService,
    private readonly activityLogs: ActivityLogsService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.dummyHash = bcrypt.hash(
      randomBytes(16).toString('hex'),
      config.get('BCRYPT_SALT_ROUNDS', { infer: true }),
    );
  }

  async login(email: string, password: string): Promise<Session> {
    const user = await this.usersService.findByEmail(email);
    const hash = user?.password ?? (await this.dummyHash);
    const valid = await bcrypt.compare(password, hash);

    if (!user?.password || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<Session> {
    const { userId, next } = await this.refreshTokens.rotate(refreshToken);
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('Session expired');

    return {
      user: toSessionUser(user),
      accessToken: await this.signAccessToken(user),
      refresh: next,
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (refreshToken) await this.refreshTokens.endSession(refreshToken);
  }

  /** Ends every other session and starts a fresh one for this client. */
  async changePassword(
    actor: AuthUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<Session> {
    const user = await this.usersService.findByEmail(actor.email);
    // 400, not 401: a wrong current password must not look like an expired session.
    if (
      !user?.password ||
      user.id !== actor.userId ||
      !(await bcrypt.compare(currentPassword, user.password))
    ) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current one',
      );
    }

    await this.usersService.setPassword(user.id, newPassword, false);
    await this.refreshTokens.endAllSessions(user.id);
    await this.activityLogs.createLog({
      actorId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'employee',
      entityId: user.id,
      description: `${user.name} changed their password.`,
    });

    user.mustChangePassword = false;
    return this.startSession(user);
  }

  /**
   * Admin reset: a one-time password the employee must replace at next login.
   * Admins reset employees; only the super admin resets admins; nobody resets the super admin.
   */
  async resetPassword(
    actor: AuthUser,
    targetId: number,
  ): Promise<{ temporaryPassword: string }> {
    const target = await this.usersService.findOne(targetId);

    if (target.id === actor.userId) {
      throw new BadRequestException(
        'Use change password for your own account.',
      );
    }
    if (
      target.role === 'super_admin' ||
      (target.role === 'admin' && actor.role !== 'super_admin')
    ) {
      throw new ForbiddenException(
        'You cannot reset the password of this account.',
      );
    }

    const temporaryPassword = randomBytes(12).toString('base64url');
    await this.usersService.setPassword(target.id, temporaryPassword, true);
    await this.refreshTokens.endAllSessions(target.id);
    await this.activityLogs.createLog({
      actorId: actor.userId,
      action: 'PASSWORD_RESET',
      entityType: 'employee',
      entityId: target.id,
      description: `${actor.name} reset the password of ${target.name} (${target.email}).`,
    });

    return { temporaryPassword };
  }

  private async startSession(user: User): Promise<Session> {
    return {
      user: toSessionUser(user),
      accessToken: await this.signAccessToken(user),
      refresh: await this.refreshTokens.startSession(user.id),
    };
  }

  private signAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id });
  }
}
