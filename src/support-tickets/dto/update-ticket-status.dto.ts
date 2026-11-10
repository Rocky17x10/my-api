import { IsEnum } from 'class-validator';

import { SupportTicketStatus } from '../support-ticket.entity';

export class UpdateTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}
