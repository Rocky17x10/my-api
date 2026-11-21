import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import type { AuthUser } from './jwt.strategy';

const ALLOW_PENDING_PASSWORD_CHANGE = 'allowPendingPasswordChange';

/** Marks the endpoints a user may call before replacing an admin-set password. */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = AuthUser>(
    err: unknown,
    user: unknown,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const authUser = super.handleRequest<AuthUser>(err, user, info, context);
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE,
      [context.getHandler(), context.getClass()],
    );
    if (authUser.mustChangePassword && !allowed) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change your password to continue.',
      });
    }
    return authUser as TUser;
  }
}
