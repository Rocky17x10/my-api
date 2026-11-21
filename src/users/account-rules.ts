import type { UserRole } from './user.entity';

/**
 * Who may change another account: edit, delete, reset its password or (de)activate it (SEC-05).
 * Returns the reason it is not allowed, or null. Admins manage employees; only the super admin
 * manages admins; the super admin account and your own account are never changed this way.
 */
export function accountChangeDenied(
  actor: { userId: number; role: UserRole },
  target: { id: number; role: UserRole },
): string | null {
  if (target.id === actor.userId) {
    return 'You cannot do this to your own account.';
  }
  if (target.role === 'super_admin') {
    return 'The Super Admin account is protected.';
  }
  if (target.role === 'admin' && actor.role !== 'super_admin') {
    return 'Only the Super Admin can change administrator accounts.';
  }
  return null;
}
