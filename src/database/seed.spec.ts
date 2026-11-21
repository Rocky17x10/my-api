import { DataSource } from 'typeorm';

import { User } from '../users/user.entity';
import { readSeedConfig, runSeed } from './seed';

const goodAdmin = {
  SEED_ADMIN_EMAIL: ' Admin@Example.com ',
  SEED_ADMIN_PASSWORD: 'a-long-password-123',
};

describe('readSeedConfig', () => {
  it('normalises the email and defaults the name', () => {
    const config = readSeedConfig(
      goodAdmin,
      { NODE_ENV: 'development' },
      false,
    );

    expect(config.admin).toEqual({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'a-long-password-123',
    });
    expect(config.demoPassword).toBeUndefined();
  });

  it('lists every problem at once', () => {
    expect(() =>
      readSeedConfig(
        { SEED_ADMIN_EMAIL: 'nope', SEED_ADMIN_PASSWORD: 'short' },
        { NODE_ENV: 'development' },
        false,
      ),
    ).toThrow(/SEED_ADMIN_EMAIL[\s\S]*SEED_ADMIN_PASSWORD/);
  });

  it('refuses demo data in production', () => {
    expect(() =>
      readSeedConfig(
        { ...goodAdmin, SEED_DEMO_PASSWORD: 'another-long-pass' },
        { NODE_ENV: 'production' },
        true,
      ),
    ).toThrow('--demo is not allowed');
  });

  it('requires a demo password for --demo', () => {
    expect(() =>
      readSeedConfig(goodAdmin, { NODE_ENV: 'development' }, true),
    ).toThrow('SEED_DEMO_PASSWORD');
  });
});

describe('runSeed (super_admin)', () => {
  const config = readSeedConfig(goodAdmin, { NODE_ENV: 'test' }, false);

  function fakeDataSource(users: { findOne?: User | null; exists?: boolean }) {
    const repo = {
      findOne: jest.fn().mockResolvedValue(users.findOne ?? null),
      exists: jest.fn().mockResolvedValue(users.exists ?? false),
      insert: jest.fn().mockResolvedValue(undefined),
    };
    return { ds: { getRepository: () => repo } as unknown as DataSource, repo };
  }

  it('creates the super_admin with a hashed password when none exists', async () => {
    const { ds, repo } = fakeDataSource({});

    await runSeed(ds, config, 10, () => undefined);

    const inserted = repo.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({
      email: 'admin@example.com',
      role: 'super_admin',
    });
    expect(inserted.password).not.toBe(goodAdmin.SEED_ADMIN_PASSWORD);
    expect(inserted.password).toMatch(/^\$2[aby]\$10\$/);
  });

  it('never touches an existing super_admin', async () => {
    const { ds, repo } = fakeDataSource({
      findOne: { email: 'boss@example.com' } as User,
    });

    await runSeed(ds, config, 10, () => undefined);

    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('refuses when the email belongs to a non-super_admin user', async () => {
    const { ds, repo } = fakeDataSource({ exists: true });

    await expect(runSeed(ds, config, 10, () => undefined)).rejects.toThrow(
      'already exists',
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
