import type { CookieOptions, Response } from 'express';

import { clearAuthCookies, CookieSettings, setAuthCookies } from './auth-cookies';
import type { Session } from './auth.service';

type Call = [name: string, value: string, options: CookieOptions];

function fakeResponse() {
  const set: Call[] = [];
  const cleared: [string, CookieOptions][] = [];
  const res = {
    cookie: (name: string, value: string, options: CookieOptions) => set.push([name, value, options]),
    clearCookie: (name: string, options: CookieOptions) => cleared.push([name, options]),
  } as unknown as Response;
  return { res, set, cleared };
}

const expiresAt = new Date('2030-01-01T00:00:00Z');
const session = {
  accessToken: 'jwt',
  refresh: { token: 'refresh', expiresAt },
  user: { role: 'admin' },
} as Pick<Session, 'accessToken' | 'refresh' | 'user'>;

const settings: CookieSettings = { secure: false, accessTtlMinutes: 15 };

describe('auth cookies', () => {
  it('sets the session hint cookie: role, HttpOnly, Lax, path /, expiring with the refresh token', () => {
    const { res, set } = fakeResponse();
    setAuthCookies(res, session, settings);

    expect(set.find(([name]) => name === 'session')).toEqual([
      'session',
      'admin',
      { httpOnly: true, sameSite: 'lax', secure: false, domain: undefined, path: '/', expires: expiresAt },
    ]);
  });

  it('marks every cookie Secure in production', () => {
    const { res, set } = fakeResponse();
    setAuthCookies(res, session, { ...settings, secure: true });

    expect(set.map(([, , o]) => o.secure)).toEqual([true, true, true]);
  });

  it('is host-only without COOKIE_DOMAIN', () => {
    const { res, set, cleared } = fakeResponse();
    setAuthCookies(res, session, settings);
    clearAuthCookies(res, settings);

    expect([...set.map(([, , o]) => o), ...cleared.map(([, o]) => o)].every((o) => o.domain === undefined)).toBe(
      true,
    );
  });

  it('sets and clears all three cookies on COOKIE_DOMAIN with the same paths', () => {
    const { res, set, cleared } = fakeResponse();
    const withDomain = { ...settings, domain: 'example.com' };
    setAuthCookies(res, session, withDomain);
    clearAuthCookies(res, withDomain);

    const expected = [
      ['access_token', '/api/v1'],
      ['refresh_token', '/api/v1/auth'],
      ['session', '/'],
    ];
    expect(set.map(([name, , o]) => [name, o.path, o.domain])).toEqual(expected.map((e) => [...e, 'example.com']));
    expect(cleared.map(([name, o]) => [name, o.path, o.domain])).toEqual(expected.map((e) => [...e, 'example.com']));
  });
});
