import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { PageQueryDto } from '../../common/pagination';
import {
  SupportTicketPriority,
  SupportTicketStatus,
} from '../support-ticket.entity';

export class TicketQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['createdAt', 'priority', 'status'])
  sort: 'createdAt' | 'priority' | 'status' = 'createdAt';

  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;
}
