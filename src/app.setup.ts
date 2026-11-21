import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvironmentVariables, parseOrigins } from './config/env.validation';

export const API_PREFIX = 'api/v1';

/** HTTP setup shared by main.ts and the e2e tests, so tests hit the same pipeline. */
export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // "/" and "/health" stay unprefixed for load balancers and uptime checks.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  app.enableCors({
    origin: parseOrigins(config.get('FRONTEND_URL', { infer: true })),
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();
}
