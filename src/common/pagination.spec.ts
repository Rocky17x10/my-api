import 'reflect-metadata';
import type { SelectQueryBuilder } from 'typeorm';

import { PageQueryDto, paginate } from './pagination';

const fakeBuilder = (rows: object[], total: number) => ({
  alias: 'item',
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
});

const pageOf = (values: Partial<PageQueryDto>) => Object.assign(new PageQueryDto(), values);

describe('paginate', () => {
  it('skips earlier pages, takes one page and rounds totalPages up', async () => {
    const builder = fakeBuilder([{ id: 1 }], 101);

    const result = await paginate(
      builder as unknown as SelectQueryBuilder<object>,
      pageOf({ page: 3, limit: 20, order: 'asc' }),
      'item.name',
    );

    expect(builder.orderBy).toHaveBeenCalledWith('item.name', 'ASC');
    expect(builder.addOrderBy).toHaveBeenCalledWith('item.id', 'ASC');
    expect(builder.skip).toHaveBeenCalledWith(40);
    expect(builder.take).toHaveBeenCalledWith(20);
    expect(result).toEqual({ data: [{ id: 1 }], total: 101, page: 3, limit: 20, totalPages: 6 });
  });

  it('defaults to page 1, 50 rows, newest first; no rows means 0 pages', async () => {
    const builder = fakeBuilder([], 0);

    const result = await paginate(builder as unknown as SelectQueryBuilder<object>, pageOf({}), 'item.id');

    expect(builder.orderBy).toHaveBeenCalledWith('item.id', 'DESC');
    expect(builder.addOrderBy).not.toHaveBeenCalled();
    expect(builder.skip).toHaveBeenCalledWith(0);
    expect(builder.take).toHaveBeenCalledWith(50);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
  });
});
