import type { CookieOptions, Request, Response } from 'express';

import { API_PREFIX } from '../app.setup';
import { IssuedRefreshToken } from './refresh-tokens.service';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The refresh token is only ever sent to /auth (refresh, logout), never to other endpoints.
const ACCESS_PATH = `/${API_PREFIX}`;
const REFRESH_PATH = `/${API_PREFIX}/auth`;

const baseOptions = (secure: boolean): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure,
});

export interface CookieSettings {
  secure: boolean;
  accessTtlMinutes: number;
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refresh: IssuedRefreshToken },
  settings: CookieSettings,
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(settings.secure),
    path: ACCESS_PATH,
    maxAge: settings.accessTtlMinutes * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refresh.token, {
    ...baseOptions(settings.secure),
    path: REFRESH_PATH,
    expires: tokens.refresh.expiresAt,
  });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(secure), path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(secure), path: REFRESH_PATH });
}

export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
