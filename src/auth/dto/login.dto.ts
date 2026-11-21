import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(150)
  email: string;

  // No strength rules here: old accounts may have shorter passwords.
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
