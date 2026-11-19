
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, {
    message: 'New password must be at least 8 characters long.',
  })
  @MaxLength(72, {
    message: 'New password cannot exceed 72 characters.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      'New password must contain uppercase, lowercase, number and special character.',
  })
  newPassword: string;
}
