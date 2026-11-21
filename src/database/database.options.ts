import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';

import { EnvironmentVariables } from '../config/env.validation';

/** Connection settings shared by the Nest app and the TypeORM CLI data source. */
export function databaseOptions(env: EnvironmentVariables): DataSourceOptions {
  return {
    type: env.DATABASE_TYPE,
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    // Compiled migrations; the CLI and production both run from dist/.
    migrations: [join(__dirname, 'migrations', '*.js')],
    // Schema changes go through migrations only, in every environment.
    synchronize: false,
  };
}
