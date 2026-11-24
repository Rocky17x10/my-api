import { NestExpressApplication } from '@nestjs/platform-express';
import request, { Response } from 'supertest';
import { DataSource } from 'typeorm';

import { SupportTicket } from '../src/support-tickets/support-ticket.entity';
import { User } from '../src/users/user.entity';
import { Agent, API, createTestApp, loginAs, makeUser, PASSWORD, resetData } from './helpers';

/** Set-Cookie headers by cookie name. */
const setCookies = (res: Response): Record<string, string> =>
  Object.fromEntries((res.get('Set-Cookie') ?? []).map((header) => [header.split('=')[0], header]));

/** "name=value; Path=/; HttpOnly" → ["name=value", "Path=/", "HttpOnly"]. */
const attributes = (header: string) => header.split('; ');

const cookieValue = (header: string) => attributes(header)[0].split('=').slice(1).join('=');

// Login is throttled (5 attempts per email, 20 per IP per minute, reset per app): each
// scenario that needs a fresh session has its own account, and this file stays under 20.
describe('auth (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let admin: Agent;
  let employee: Agent;
  let emp: User;

  const login = (email: string, password = PASSWORD) =>
    request(app.getHttpServer()).post(`${API}/auth/login`).send({ email, password });

  const refresh = (token: string) =>
    request(app.getHttpServer())
      .post(`${API}/auth/refresh`)
      .set('Cookie', `refresh_token=${token}`);

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await resetData(dataSource);
    await makeUser(dataSource, 'admin', 'admin@e2e.test');
    emp = await makeUser(dataSource, 'user', 'emp@e2e.test');
    admin = await loginAs(app, 'admin@e2e.test');
    employee = await loginAs(app, 'emp@e2e.test');
  });

  afterAll(async () => {
    await app.close();
  });

  it('login sets HttpOnly access, refresh and session-hint cookies and returns only the user', async () => {
    const res = await login('emp@e2e.test').expect(200);
    const cookies = setCookies(res);

    expect(attributes(cookies.access_token)).toEqual(
      expect.arrayContaining(['Path=/api/v1', 'HttpOnly', 'SameSite=Lax']),
    );
    expect(attributes(cookies.refresh_token)).toEqual(
      expect.arrayContaining(['Path=/api/v1/auth', 'HttpOnly', 'SameSite=Lax']),
    );
    expect(attributes(cookies.access_token)).not.toContain('Secure');
    // Role hint for the frontend's redirects, sent to every path, expiring with the refresh token.
    expect(attributes(cookies.session)).toEqual(
      expect.arrayContaining(['session=user', 'Path=/', 'HttpOnly', 'SameSite=Lax']),
    );
    expect(cookies.session.match(/Expires=[^;]+/)?.[0]).toBe(
      cookies.refresh_token.match(/Expires=[^;]+/)?.[0],
    );
    expect(cookies.session).not.toContain('Domain='); // COOKIE_DOMAIN unset: host-only

    expect(Object.keys(res.body as object)).toEqual(['user']);
    expect(res.body).toMatchObject({ user: { id: emp.id, email: 'emp@e2e.test', role: 'user' } });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(cookieValue(cookies.access_token));
    expect(body).not.toContain(cookieValue(cookies.refresh_token));
    expect(res.body).not.toHaveProperty('user.password');
  });

  it('wrong password: 401, no cookies', async () => {
    const res = await login('emp@e2e.test', 'wrong-password').expect(401);
    expect(res.body).toMatchObject({ message: 'Invalid email or password' });
    expect(setCookies(res)).toEqual({});
  });

  it('missing password: 400', async () => {
    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'emp@e2e.test' })
      .expect(400);
  });

  it('profile: 200 with the cookie, 401 without', async () => {
    await employee.get(`${API}/auth/profile`).expect(200, {
      user: {
        id: emp.id,
        name: 'emp',
        email: 'emp@e2e.test',
        role: 'user',
        department: null,
        designation: null,
        mustChangePassword: false,
      },
    });
    await request(app.getHttpServer()).get(`${API}/auth/profile`).expect(401);
  });

  it('refresh rotates the token; reusing a rotated one revokes the session', async () => {
    await makeUser(dataSource, 'user', 'refresh@e2e.test');
    const first = cookieValue(setCookies(await login('refresh@e2e.test').expect(200)).refresh_token);

    const rotated = await refresh(first).expect(200);
    expect(rotated.body).toMatchObject({ user: { email: 'refresh@e2e.test' } });
    expect(setCookies(rotated).access_token).toBeDefined();
    expect(cookieValue(setCookies(rotated).session)).toBe('user');
    const second = cookieValue(setCookies(rotated).refresh_token);
    expect(second).not.toBe(first);

    const replayed = await refresh(first).expect(401); // someone replayed a used token...
    expect(setCookies(replayed).session).toMatch(/^session=;.*Path=\/;.*Expires=Thu, 01 Jan 1970/);
    await refresh(second).expect(401); // ...so the whole session is gone
  });

  it('logout: 204, clears all three cookies, and the old refresh token is dead', async () => {
    await makeUser(dataSource, 'user', 'logout@e2e.test');
    const token = cookieValue(setCookies(await login('logout@e2e.test').expect(200)).refresh_token);

    const res = await request(app.getHttpServer())
      .post(`${API}/auth/logout`)
      .set('Cookie', `refresh_token=${token}`)
      .expect(204);
    const cleared = setCookies(res);
    expect(cleared.access_token).toMatch(/^access_token=;.*Expires=Thu, 01 Jan 1970/);
    expect(cleared.refresh_token).toMatch(/^refresh_token=;.*Expires=Thu, 01 Jan 1970/);
    expect(cleared.session).toMatch(/^session=;.*Path=\/;.*Expires=Thu, 01 Jan 1970/);

    await refresh(token).expect(401);
  });

  it('refuses a write from a foreign Origin (403), even with a valid session', async () => {
    const res = await employee
      .post(`${API}/support-tickets`)
      .set('Origin', 'http://evil.example')
      .send({ subject: 'CSRF', category: 'hardware', description: 'Must never be created.' })
      .expect(403);
    expect(res.body).toMatchObject({ message: 'Origin not allowed' });
    expect(await dataSource.getRepository(SupportTicket).count()).toBe(0);
  });

  it('deactivated user: the live cookie gets 401, login gets 403', async () => {
    const user = await makeUser(dataSource, 'user', 'deact@e2e.test');
    const session = await loginAs(app, 'deact@e2e.test');
    await session.get(`${API}/auth/profile`).expect(200);

    await admin
      .patch(`${API}/auth/users/${user.id}/active`)
      .send({ active: false })
      .expect(200, { id: user.id, isActive: false });

    await session.get(`${API}/auth/profile`).expect(401);
    await session.post(`${API}/auth/refresh`).expect(401);
    const res = await login('deact@e2e.test').expect(403);
    expect(res.body).toMatchObject({
      message: 'This account is deactivated. Contact an administrator.',
    });
  });

  it('deleted user (no history): the live cookie gets 401', async () => {
    const user = await makeUser(dataSource, 'user', 'gone@e2e.test');
    const session = await loginAs(app, 'gone@e2e.test');

    await admin
      .delete(`${API}/users/${user.id}`)
      .expect(200, { message: 'User deleted successfully' });

    await session.get(`${API}/auth/profile`).expect(401);
  });

  it('admin-created user must change the password before using anything else', async () => {
    const created = await admin
      .post(`${API}/users`)
      .send({ name: 'Newbie', email: 'newbie@e2e.test', password: 'initial-pass-123' })
      .expect(201);
    expect(created.body).toMatchObject({ email: 'newbie@e2e.test', mustChangePassword: true });
    expect(created.body).not.toHaveProperty('password');

    const newbie = await loginAs(app, 'newbie@e2e.test', 'initial-pass-123');
    const blocked = await newbie.get(`${API}/assets`).expect(403);
    expect(blocked.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
    const profile = await newbie.get(`${API}/auth/profile`).expect(200);
    expect(profile.body).toMatchObject({ user: { mustChangePassword: true } });

    const changed = await newbie
      .patch(`${API}/auth/password`)
      .send({ currentPassword: 'initial-pass-123', newPassword: 'brand-new-pass-456' })
      .expect(200);
    expect(changed.body).toMatchObject({ user: { mustChangePassword: false } });
    await newbie.get(`${API}/assets`).expect(200);
  });

  // Last: it spends 6 of the 20 login attempts per IP this file may use.
  it('throttles the 6th wrong password for one email (429)', async () => {
    await makeUser(dataSource, 'user', 'throttle@e2e.test');
    for (let attempt = 1; attempt <= 5; attempt++) {
      await login('throttle@e2e.test', 'wrong-password').expect(401);
    }
    const res = await login('throttle@e2e.test', 'wrong-password').expect(429);
    expect(res.body).toMatchObject({ message: 'Too many attempts. Wait a minute and try again.' });
  });
});
