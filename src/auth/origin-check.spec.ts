import type { NextFunction, Request, Response } from 'express';

import { originCheck } from './origin-check';

function run(method: string, origin?: string) {
  const next = jest.fn() as NextFunction;
  const status = jest.fn(() => ({ json: jest.fn() }));
  const res = { status } as unknown as Response;
  const req = { method, headers: origin ? { origin } : {} } as Request;
  originCheck(['http://localhost:3002'])(req, res, next);
  return { next, status };
}

describe('originCheck', () => {
  it('allows writes from the frontend and from clients without Origin', () => {
    expect(run('POST', 'http://localhost:3002').next).toHaveBeenCalled();
    expect(run('PATCH').next).toHaveBeenCalled();
  });

  it('allows reads from anywhere (CORS still hides the response)', () => {
    expect(run('GET', 'http://evil.example').next).toHaveBeenCalled();
  });

  it('refuses writes from other origins, including "null"', () => {
    for (const origin of [
      'http://evil.example',
      'http://localhost:3000',
      'null',
    ]) {
      const { next, status } = run('POST', origin);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(403);
    }
  });
});
