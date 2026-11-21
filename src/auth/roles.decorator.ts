
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

/** Any logged-in user. RolesGuard refuses routes that declare no roles at all (SEC-11). */
export const AnyRole = () => Roles('super_admin', 'admin', 'user');
