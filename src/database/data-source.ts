// Data source for the TypeORM CLI (npm run migration:*). Runs from dist/ after `nest build`.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { validateEnv } from '../config/env.validation';
import { databaseOptions } from './database.options';

// Production passes real environment variables; .env is a local-development convenience.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default new DataSource({
  ...databaseOptions(validateEnv(process.env)),
  entities: [join(__dirname, '..', '**', '*.entity.js')],
});
