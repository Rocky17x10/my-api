import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { AssetListQueryDto } from './asset.dto';

const parse = (query: Record<string, string>) => plainToInstance(AssetListQueryDto, query);
const errors = (query: Record<string, string>) =>
  validateSync(parse(query), { whitelist: true, forbidNonWhitelisted: true }).map((e) => e.property);

describe('AssetListQueryDto', () => {
  it('defaults to the old order (id DESC), first page of 50', () => {
    expect(errors({})).toEqual([]);
    expect(parse({})).toMatchObject({ page: 1, limit: 50, order: 'desc', sort: 'id' });
  });

  it('converts and accepts the filters', () => {
    expect(errors({ page: '2', limit: '100', sort: 'assetTag', status: 'retired', category: 'Laptop' })).toEqual([]);
    expect(parse({ page: '2', limit: '100' })).toMatchObject({ page: 2, limit: 100 });
  });

  it('rejects an unknown sort, status or key and limit over 100', () => {
    expect(errors({ sort: 'password' })).toEqual(['sort']);
    expect(errors({ sort: 'asset.name; DROP TABLE assets' })).toEqual(['sort']);
    expect(errors({ limit: '101' })).toEqual(['limit']);
    expect(errors({ status: 'lost' })).toEqual(['status']);
    expect(errors({ assignedTo: '1' })).toEqual(['assignedTo']);
  });
});
