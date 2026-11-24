import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';

import { API, createTestApp, loginAs, makeUser, resetData } from './helpers';

describe('e2e harness', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await resetData(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs on the throwaway test database, built by the migrations', async () => {
    expect(dataSource.options.database).toBe('myapp_test');
    const [{ applied }] = await dataSource.query<{ applied: string }[]>(
      'SELECT COUNT(*) AS applied FROM migrations',
    );
    expect(Number(applied)).toBeGreaterThanOrEqual(4);
  });

  it('logs in through the real HTTP pipeline with cookies', async () => {
    await makeUser(dataSource, 'admin', 'admin@e2e.test');
    const admin = await loginAs(app, 'admin@e2e.test');

    const res = await admin.get(`${API}/auth/profile`).expect(200);
    expect(res.body).toMatchObject({ user: { email: 'admin@e2e.test', role: 'admin' } });
  });
});
