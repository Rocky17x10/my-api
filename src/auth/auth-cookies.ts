import type { CookieOptions, Request, Response } from 'express';

import { API_PREFIX } from '../app.setup';
import type { Session } from './auth.service';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
// The user's role, readable by the frontend server (Next.js middleware) for route redirects.
// Only a hint: the API never reads it and still authorises every request from the access token.
export const SESSION_COOKIE = 'session';

// The refresh token is only ever sent to /auth (refresh, logout), never to other endpoints.
const ACCESS_PATH = `/${API_PREFIX}`;
const REFRESH_PATH = `/${API_PREFIX}/auth`;
const SESSION_PATH = '/';

export interface CookieSettings {
  secure: boolean;
  accessTtlMinutes: number;
  /** COOKIE_DOMAIN, so sibling subdomains share the cookies; undefined = host-only. */
  domain?: string;
}

const baseOptions = ({ secure, domain }: CookieSettings): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure,
  domain,
});

export function setAuthCookies(
  res: Response,
  session: Pick<Session, 'accessToken' | 'refresh' | 'user'>,
  settings: CookieSettings,
): void {
  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...baseOptions(settings),
    path: ACCESS_PATH,
    maxAge: settings.accessTtlMinutes * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, session.refresh.token, {
    ...baseOptions(settings),
    path: REFRESH_PATH,
    expires: session.refresh.expiresAt,
  });
  res.cookie(SESSION_COOKIE, session.user.role, {
    ...baseOptions(settings),
    path: SESSION_PATH,
    expires: session.refresh.expiresAt,
  });
}

export function clearAuthCookies(res: Response, settings: CookieSettings): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(settings), path: ACCESS_PATH });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(settings), path: REFRESH_PATH });
  res.clearCookie(SESSION_COOKIE, { ...baseOptions(settings), path: SESSION_PATH });
}

export function readCookie(req: Request, name: string): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' && value !== '' ? value : undefined;
}
