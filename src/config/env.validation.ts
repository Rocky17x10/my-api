import { plainToInstance, Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export type NodeEnv = 'development' | 'production' | 'test';
export type DatabaseType = 'mysql' | 'mariadb';

export class EnvironmentVariables {
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: NodeEnv = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  // Must match the server: TypeORM's mysql driver misreads MariaDB metadata and
  // reports phantom schema changes.
  @IsIn(['mysql', 'mariadb'])
  DATABASE_TYPE: DatabaseType = 'mysql';

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST = 'localhost';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT = 3306;

  @IsString()
  @IsNotEmpty()
  DATABASE_USERNAME!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  /** Access token (JWT) and its cookie live this long; the refresh token renews it. */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(60)
  JWT_ACCESS_TTL_MINUTES = 15;

  /** Refresh token lifetime; each refresh starts a new one (sliding session). */
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(30)
  REFRESH_TOKEN_TTL_DAYS = 7;

  /** Comma-separated list of origins allowed by CORS. */
  @IsString()
  @IsNotEmpty()
  FRONTEND_URL!: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(10)
  @Max(15)
  BCRYPT_SALT_ROUNDS = 12;

  @IsOptional()
  @IsString()
  OBSERVE_APP_KEY?: string;

  @IsOptional()
  @IsString()
  OBSERVE_APP_SECRET?: string;
}

// Keys used before Phase 2; existing .env files keep working without edits.
const LEGACY_KEYS: Record<string, keyof EnvironmentVariables> = {
  DB_PASSWORD: 'DATABASE_PASSWORD',
  JWT_SECRET: 'JWT_ACCESS_SECRET',
};

/** Used by ConfigModule.forRoot({ validate }): the app refuses to start on invalid config. */
export function validateEnv(
  raw: Record<string, unknown>,
): EnvironmentVariables {
  const input = { ...raw };
  for (const [legacy, current] of Object.entries(LEGACY_KEYS)) {
    if (input[current] === undefined && input[legacy] !== undefined) {
      input[current] = input[legacy];
    }
  }

  const env = plainToInstance(EnvironmentVariables, input, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return env;
}

/** Origins from FRONTEND_URL, e.g. "http://localhost:3000,http://localhost:3002". */
export function parseOrigins(frontendUrl: string): string[] {
  return frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
