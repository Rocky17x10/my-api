import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { AuthUser } from '../auth/jwt.strategy';

/** The logged-in user (set by JwtAuthGuard). Use only on routes behind JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
