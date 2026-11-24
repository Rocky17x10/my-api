import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

import { DatabaseErrorFilter } from './database-error.filter';

function run(code: string) {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const error = new QueryFailedError('INSERT ...', [], Object.assign(new Error('db'), { code }));
  const filter = new DatabaseErrorFilter();
  const fallback = jest
    .spyOn(Object.getPrototypeOf(DatabaseErrorFilter.prototype) as { catch: () => void }, 'catch')
    .mockImplementation(() => undefined);
  filter.catch(error, host);
  return { status, json, fallback };
}

describe('DatabaseErrorFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('maps a duplicate key to 409 without SQL details', () => {
    const { status, json } = run('ER_DUP_ENTRY');

    expect(status).toHaveBeenCalledWith(409);
    const body = json.mock.calls[0][0] as { message: string };
    expect(body.message).not.toMatch(/INSERT|Duplicate entry/);
  });

  it('maps a delete blocked by a foreign key to 409', () => {
    expect(run('ER_ROW_IS_REFERENCED_2').status).toHaveBeenCalledWith(409);
  });

  it('maps a NULL in a required column to 400', () => {
    expect(run('ER_BAD_NULL_ERROR').status).toHaveBeenCalledWith(400);
  });

  it('leaves unknown database errors to the default 500 handler', () => {
    const { status, fallback } = run('ER_LOCK_DEADLOCK');

    expect(status).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalled();
  });
});
