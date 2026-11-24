import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsAcceptablePassword } from '../password.policy';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @IsAcceptablePassword()
  newPassword: string;
}
