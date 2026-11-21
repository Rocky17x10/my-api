import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UserListQueryDto } from './user-list-query.dto';

const parse = (query: Record<string, string>) => plainToInstance(UserListQueryDto, query);
const errors = (query: Record<string, string>) =>
  validateSync(parse(query), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);

describe('UserListQueryDto', () => {
  it('defaults to the old order (id DESC), first page of 50', () => {
    expect(errors({})).toEqual([]);
    expect(parse({})).toMatchObject({ page: 1, limit: 50, order: 'desc', sort: 'id' });
  });

  it("turns isActive 'true'/'false' into booleans", () => {
    expect(errors({ isActive: 'false', role: 'user', sort: 'email' })).toEqual([]);
    expect(parse({ isActive: 'true' }).isActive).toBe(true);
    expect(parse({ isActive: 'false' }).isActive).toBe(false);
  });

  it('rejects an unknown sort, role or isActive and limit over 100', () => {
    expect(errors({ sort: 'password' })).toEqual(['sort']);
    expect(errors({ limit: '101' })).toEqual(['limit']);
    expect(errors({ role: 'root' })).toEqual(['role']);
    expect(errors({ isActive: 'yes' })).toEqual(['isActive']);
  });
});
