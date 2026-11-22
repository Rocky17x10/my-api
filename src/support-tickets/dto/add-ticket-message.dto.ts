import {
  IsBoolean,
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';

export class AddTicketMessageDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  message: string;

  /** Staff-only note: admins only, never shown to or notified to the employee. */
  @IsOptional()
  @IsBoolean()
  isInternalNote?: boolean;
}
