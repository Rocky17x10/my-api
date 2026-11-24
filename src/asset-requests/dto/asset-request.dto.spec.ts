import 'reflect-metadata'; // @Type() on PageQueryDto reads design metadata; Nest loads this outside tests.
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AssetRequestQueryDto } from './asset-request.dto';

// Query strings arrive as strings; the global pipe uses whitelist + forbidNonWhitelisted.
const parse = (query: object) => {
  const dto = plainToInstance(AssetRequestQueryDto, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors: errors.map((e) => e.property).sort() };
};

describe('AssetRequestQueryDto', () => {
  it('fills the defaults (newest first)', () => {
    const { dto, errors } = parse({});
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      page: 1,
      limit: 50,
      order: 'desc',
      sort: 'createdAt',
    });
  });

  it('accepts a valid page, sort, filter and search', () => {
    const { dto, errors } = parse({
      page: '2',
      limit: '100',
      sort: 'itemName',
      order: 'asc',
      status: 'pending',
      search: 'laptop',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 100 });
  });

  it('rejects an unknown sort, limit=101, an unknown status and unknown keys', () => {
    expect(parse({ sort: 'bogus', limit: '101' }).errors).toEqual([
      'limit',
      'sort',
    ]);
    expect(parse({ status: 'deleted' }).errors).toEqual(['status']);
    expect(parse({ requestedBy: '3' }).errors).toEqual(['requestedBy']);
  });
});
