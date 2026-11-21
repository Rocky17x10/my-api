import { accountChangeDenied } from './account-rules';

const admin = { userId: 1, role: 'admin' as const };
const superAdmin = { userId: 2, role: 'super_admin' as const };

describe('accountChangeDenied', () => {
  it.each([
    ['admin -> employee', admin, { id: 9, role: 'user' as const }],
    ['super admin -> admin', superAdmin, { id: 9, role: 'admin' as const }],
    ['super admin -> employee', superAdmin, { id: 9, role: 'user' as const }],
  ])('allows %s', (_case, actor, target) => {
    expect(accountChangeDenied(actor, target)).toBeNull();
  });

  it.each([
    ['admin -> another admin', admin, { id: 9, role: 'admin' as const }],
    ['admin -> own account', admin, { id: 1, role: 'admin' as const }],
    ['admin -> super admin', admin, { id: 2, role: 'super_admin' as const }],
    ['super admin -> own account', superAdmin, { id: 2, role: 'super_admin' as const }],
  ])('refuses %s', (_case, actor, target) => {
    expect(accountChangeDenied(actor, target)).toEqual(expect.any(String));
  });
});
