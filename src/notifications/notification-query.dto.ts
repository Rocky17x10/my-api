import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { PageQueryDto } from '../common/pagination';

export class NotificationQueryDto extends PageQueryDto {
  // The notification list has always returned the latest 30.
  limit = 30;

  // ?unread=true lists unread notifications only; false or omitted lists all.
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  unread?: boolean;
}
