// Loaded before every e2e test file (and by the global setup): the tests talk to a throwaway
// database, never the dev one. Real env vars win over .env, so this overrides DATABASE_NAME.
process.env.NODE_ENV = 'test';
process.env.DATABASE_NAME = process.env.E2E_DATABASE_NAME || 'myapp_test';
process.env.BCRYPT_SALT_ROUNDS = '10';

if (!process.env.DATABASE_NAME.endsWith('_test')) {
  throw new Error(
    `e2e tests empty their database; refusing to use "${process.env.DATABASE_NAME}" (name must end in _test)`,
  );
}
