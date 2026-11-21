import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

import { PageQueryDto } from '../../common/pagination';
import type { UserRole } from '../user.entity';

const USER_SORTS = ['id', 'name', 'email', 'role'] as const;

// GET /users: page, sort and filters.
export class UserListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(USER_SORTS)
  sort: (typeof USER_SORTS)[number] = 'id';

  @IsOptional()
  @IsIn(['super_admin', 'admin', 'user'])
  role?: UserRole;

  // Query strings arrive as text; anything but 'true'/'false' stays as is and fails @IsBoolean.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}
