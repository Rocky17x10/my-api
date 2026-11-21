import { parseOrigins, validateEnv } from './env.validation';

const required = {
  DATABASE_USERNAME: 'appuser',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'myapp_db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  FRONTEND_URL: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('applies defaults for optional values', () => {
    const env = validateEnv(required);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_TYPE).toBe('mysql');
    expect(env.DATABASE_HOST).toBe('localhost');
    expect(env.DATABASE_PORT).toBe(3306);
    expect(env.BCRYPT_SALT_ROUNDS).toBe(12);
    expect(env.JWT_ACCESS_TTL_MINUTES).toBe(15);
    expect(env.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('converts numeric strings from .env', () => {
    const env = validateEnv({ ...required, PORT: '4000', BCRYPT_SALT_ROUNDS: '11' });

    expect(env.PORT).toBe(4000);
    expect(env.BCRYPT_SALT_ROUNDS).toBe(11);
  });

  it('accepts the pre-Phase-2 key names', () => {
    const { DATABASE_PASSWORD, JWT_ACCESS_SECRET, ...rest } = required;
    const env = validateEnv({
      ...rest,
      DB_PASSWORD: DATABASE_PASSWORD,
      JWT_SECRET: JWT_ACCESS_SECRET,
    });

    expect(env.DATABASE_PASSWORD).toBe('secret');
    expect(env.JWT_ACCESS_SECRET).toBe(JWT_ACCESS_SECRET);
  });

  it('prefers the new key when both are set', () => {
    const env = validateEnv({ ...required, DB_PASSWORD: 'old' });

    expect(env.DATABASE_PASSWORD).toBe('secret');
  });

  it.each([
    ['missing database name', { DATABASE_NAME: undefined }, 'DATABASE_NAME'],
    ['short JWT secret', { JWT_ACCESS_SECRET: 'short' }, 'JWT_ACCESS_SECRET'],
    ['non-numeric port', { PORT: 'abc' }, 'PORT'],
    ['bcrypt cost too low', { BCRYPT_SALT_ROUNDS: '4' }, 'BCRYPT_SALT_ROUNDS'],
    ['unknown NODE_ENV', { NODE_ENV: 'staging' }, 'NODE_ENV'],
    ['unsupported database type', { DATABASE_TYPE: 'postgres' }, 'DATABASE_TYPE'],
  ])('rejects %s', (_name, override, key) => {
    expect(() => validateEnv({ ...required, ...override })).toThrow(key);
  });
});

describe('parseOrigins', () => {
  it('splits and trims a comma-separated list', () => {
    expect(parseOrigins(' http://a.test , http://b.test,,')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });
});
