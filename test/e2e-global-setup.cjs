// Runs once before the e2e suite: rebuilds the test database from the compiled migrations,
// the same way a real deployment creates its schema (`npm run build` runs first).
const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { DataSource } = require('typeorm');

module.exports = async () => {
  require('./e2e-env.cjs');
  // Credentials from .env; variables already set (DATABASE_NAME above) are not overridden.
  const envFile = join(__dirname, '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const dist = join(__dirname, '..', 'dist');
  const { validateEnv } = require(join(dist, 'config', 'env.validation.js'));
  const { databaseOptions } = require(join(dist, 'database', 'database.options.js'));

  // Migration classes loaded explicitly: TypeORM's glob loading mangles Windows paths under Jest.
  const migrationsDir = join(dist, 'database', 'migrations');
  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.js'))
    .flatMap((file) => Object.values(require(join(migrationsDir, file))));

  // Entities too, as `npm run migration:run` loads them: TypeORM creates its `typeorm_metadata`
  // table (needed by AddIntegrityGuards) only when it knows about generated columns.
  const entities = readdirSync(dist, { recursive: true })
    .filter((file) => String(file).endsWith('.entity.js'))
    .flatMap((file) => Object.values(require(join(dist, String(file)))))
    .filter((value) => typeof value === 'function');

  const dataSource = new DataSource({
    ...databaseOptions(validateEnv(process.env)),
    entities,
    migrations,
  });

  await dataSource.initialize();
  try {
    if (!String(dataSource.options.database).endsWith('_test')) {
      throw new Error(`refusing to drop "${String(dataSource.options.database)}"`);
    }
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
};
