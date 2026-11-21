import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { originCheck } from './auth/origin-check';
import { EnvironmentVariables, parseOrigins } from './config/env.validation';
import { DatabaseErrorFilter } from './database/database-error.filter';

export const API_PREFIX = 'api/v1';

/** HTTP setup shared by main.ts and the e2e tests, so tests hit the same pipeline. */
export function setupApp(app: NestExpressApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  // "/" and "/health" stay unprefixed for load balancers and uptime checks.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: 'health', method: RequestMethod.GET },
    ],
  });

  const origins = parseOrigins(config.get('FRONTEND_URL', { infer: true }));
  // Auth travels in HttpOnly cookies, so browsers must send credentials cross-origin.
  app.enableCors({ origin: origins, credentials: true });
  // "same-site": the frontend on another localhost port must still read responses.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.useBodyParser('json', { limit: '100kb' });
  app.use(cookieParser());
  app.use(originCheck(origins));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(
    new DatabaseErrorFilter(app.get(HttpAdapterHost).httpAdapter),
  );

  app.enableShutdownHooks();
}
