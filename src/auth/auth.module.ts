import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { EnvironmentVariables } from '../config/env.validation';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken } from './refresh-token.entity';
import { RefreshTokensService } from './refresh-tokens.service';

// Login and password-change attempts, counted per IP and per account (SEC-01).
// shortcut: in-memory counters, per process; use a shared store (Redis) with more than one API instance.
function accountTracker(req: Record<string, unknown>): string {
  const body = req.body as { email?: unknown } | undefined;
  const user = req.user as { email?: string } | undefined;
  const email =
    typeof body?.email === 'string' ? body.email.trim().toLowerCase() : user?.email;
  return email ? `account:${email}` : `ip:${String(req.ip)}`;
}

@Module({
  imports: [
    UsersModule,
    ActivityLogsModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken]),
    ThrottlerModule.forRoot({
      errorMessage: 'Too many attempts. Wait a minute and try again.',
      throttlers: [
        { name: 'per-ip', ttl: 60_000, limit: 20 },
        { name: 'per-account', ttl: 60_000, limit: 5, getTracker: accountTracker },
      ],
    }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_ACCESS_TTL_MINUTES', { infer: true }) * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokensService, JwtStrategy, JwtAuthGuard],
})
export class AuthModule {}
