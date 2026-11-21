// Seeds the first super_admin (all environments) and optional demo data (never in production).
//   npm run seed              -> super_admin from SEED_ADMIN_* env vars
//   npm run seed -- --demo    -> also demo employees + assets (needs SEED_DEMO_PASSWORD)
// Safe to run repeatedly: existing rows are left untouched. Run after `npm run migration:run`.
import { validateEnv } from '../config/env.validation';
import dataSource from './data-source';
import { readSeedConfig, runSeed } from './seed';

async function main(): Promise<void> {
  const env = validateEnv(process.env);
  const config = readSeedConfig(
    process.env,
    env,
    process.argv.includes('--demo'),
  );

  await dataSource.initialize();
  try {
    await runSeed(dataSource, config, env.BCRYPT_SALT_ROUNDS);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
