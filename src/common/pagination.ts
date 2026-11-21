import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export const MAX_PAGE_SIZE = 100;

/** `?page=&limit=&order=&search=` shared by list endpoints. Endpoint DTOs add `sort` and filters. */
export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 50;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

/** The list envelope (same shape `/activity-logs` has always returned). */
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Applies `orderBy` (plus `id` as tie-breaker), `skip` and `take`, then counts and loads one page. */
export async function paginate<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  page: PageQueryDto,
  sortColumn: string,
): Promise<Page<T>> {
  const direction = page.order === 'asc' ? 'ASC' : 'DESC';
  const idColumn = `${query.alias}.id`;
  query.orderBy(sortColumn, direction);
  // Equal sort values (status, name, …) need a fixed order, or rows repeat or vanish between pages.
  if (sortColumn !== idColumn) query.addOrderBy(idColumn, direction);

  const [data, total] = await query
    .skip((page.page - 1) * page.limit)
    .take(page.limit)
    .getManyAndCount();

  return {
    data,
    total,
    page: page.page,
    limit: page.limit,
    totalPages: Math.ceil(total / page.limit),
  };
}
