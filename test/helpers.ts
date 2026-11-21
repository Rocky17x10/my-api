import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { setupApp } from '../src/app.setup';
import { User, UserRole } from '../src/users/user.entity';

export const API = '/api/v1';
export const PASSWORD = 'e2e-password-123';

/** The real app (same pipeline as main.ts) on the test database. */
export async function createTestApp(): Promise<{
  app: NestExpressApplication;
  dataSource: DataSource;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  setupApp(app);
  await app.init();
  return { app, dataSource: app.get(DataSource) };
}

/** Empties every table. Only ever on a *_test database (also guarded in e2e-env.cjs). */
export async function resetData(dataSource: DataSource): Promise<void> {
  if (!String(dataSource.options.database).endsWith('_test')) {
    throw new Error(`refusing to empty "${String(dataSource.options.database)}"`);
  }
  // One connection: FOREIGN_KEY_CHECKS is per session.
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { tableName } of dataSource.entityMetadatas) {
      await runner.query(`TRUNCATE TABLE \`${tableName}\``);
    }
    await runner.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await runner.release();
  }
}

/** Inserts a ready-to-use account (password PASSWORD, no forced change). */
export async function makeUser(
  dataSource: DataSource,
  role: UserRole,
  email: string,
  extra: Partial<User> = {},
): Promise<User> {
  return dataSource.getRepository(User).save({
    name: email.split('@')[0],
    email,
    role,
    password: await bcrypt.hash(PASSWORD, 10),
    mustChangePassword: false,
    isActive: true,
    ...extra,
  });
}

export type Agent = ReturnType<typeof request.agent>;

/** A supertest agent that keeps the session cookies, logged in as `email`. */
export async function loginAs(
  app: NestExpressApplication,
  email: string,
  password = PASSWORD,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);
  return agent;
}
