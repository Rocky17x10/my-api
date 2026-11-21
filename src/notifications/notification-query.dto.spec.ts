import 'reflect-metadata'; // @Type() on PageQueryDto reads design metadata; Nest loads this outside tests.
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { NotificationQueryDto } from './notification-query.dto';

const parse = (query: object) => {
  const dto = plainToInstance(NotificationQueryDto, query);
  const errors = validateSync(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors: errors.map((e) => e.property) };
};

describe('NotificationQueryDto', () => {
  it('defaults to 30 per page and keeps the shared limit checks', () => {
    expect(parse({})).toMatchObject({
      dto: { limit: 30, page: 1, order: 'desc' },
      errors: [],
    });
    expect(parse({ limit: '101' }).errors).toEqual(['limit']);
  });

  it('reads unread=true/false as booleans and rejects anything else', () => {
    expect(parse({ unread: 'true' })).toMatchObject({
      dto: { unread: true },
      errors: [],
    });
    expect(parse({ unread: 'false' })).toMatchObject({
      dto: { unread: false },
      errors: [],
    });
    expect(parse({ unread: 'yes' }).errors).toEqual(['unread']);
  });
});
