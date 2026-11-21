import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { User } from '../src/users/user.entity';
import { Agent, API, createTestApp, loginAs, makeUser, resetData } from './helpers';

// Routes only super_admin and admin may call.
const ADMIN_ONLY: ['get' | 'post', string][] = [
  ['get', '/users'],
  ['post', '/assets'],
  ['get', '/asset-requests'],
  ['get', '/asset-returns'],
  ['get', '/maintenance'],
  ['get', '/reports/assets'],
  ['get', '/activity-logs'],
  ['get', '/dashboard/statistics'],
];

describe('roles and account rules (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let superAdmin: Agent;
  let admin: Agent;
  let employee: Agent;
  let superUser: User;
  let adminUser: User;
  let peerAdmin: User;
  let emp: User;

  /** Edit, password reset, deactivation and deletion of account `id` by `agent`: the status codes. */
  async function changeAccount(agent: Agent, id: number): Promise<number[]> {
    return [
      (await agent.patch(`${API}/users/${id}`).send({ designation: 'Changed' })).status,
      (await agent.post(`${API}/auth/users/${id}/reset-password`)).status,
      (await agent.patch(`${API}/auth/users/${id}/active`).send({ active: false })).status,
      (await agent.delete(`${API}/users/${id}`)).status,
    ];
  }

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await resetData(dataSource);
    superUser = await makeUser(dataSource, 'super_admin', 'super@e2e.test');
    adminUser = await makeUser(dataSource, 'admin', 'admin@e2e.test');
    peerAdmin = await makeUser(dataSource, 'admin', 'peer@e2e.test');
    emp = await makeUser(dataSource, 'user', 'emp@e2e.test');
    superAdmin = await loginAs(app, 'super@e2e.test');
    admin = await loginAs(app, 'admin@e2e.test');
    employee = await loginAs(app, 'emp@e2e.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ADMIN_ONLY)('employee gets 403 on %s %s', async (method, path) => {
    await employee[method](`${API}${path}`).expect(403);
  });

  it.each(ADMIN_ONLY)('anonymous gets 401 on %s %s', async (method, path) => {
    await request(app.getHttpServer())[method](`${API}${path}`).expect(401);
  });

  it('admin cannot edit, reset, deactivate or delete another admin', async () => {
    expect(await changeAccount(admin, peerAdmin.id)).toEqual([403, 403, 403, 403]);
  });

  it('admin cannot do any of that to their own account', async () => {
    expect(await changeAccount(admin, adminUser.id)).toEqual([403, 403, 403, 403]);
  });

  it('only super_admin changes roles', async () => {
    await admin.patch(`${API}/users/${emp.id}/role`).send({ role: 'admin' }).expect(403);
  });

  it('super_admin can manage an admin', async () => {
    const target = await makeUser(dataSource, 'admin', 'managed@e2e.test');
    expect(await changeAccount(superAdmin, target.id)).toEqual([200, 200, 200, 200]);
  });

  it('nobody can change the super_admin account, not even its owner', async () => {
    expect(await changeAccount(admin, superUser.id)).toEqual([403, 403, 403, 403]);
    expect(await changeAccount(employee, superUser.id)).toEqual([403, 403, 403, 403]);
    expect(await changeAccount(superAdmin, superUser.id)).toEqual([403, 403, 403, 403]);
    await superAdmin.patch(`${API}/users/${superUser.id}/role`).send({ role: 'admin' }).expect(403);
  });

  it('refuses to delete a user with activity history (409)', async () => {
    await employee
      .post(`${API}/asset-requests`)
      .send({ itemName: 'Mouse', category: 'Accessory', reason: 'Mine broke' })
      .expect(201);

    const res = await admin.delete(`${API}/users/${emp.id}`).expect(409);
    expect(res.body).toMatchObject({ message: expect.stringContaining('Deactivate') as unknown });
  });
});
