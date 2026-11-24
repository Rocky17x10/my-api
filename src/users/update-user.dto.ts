import { OmitType } from '@nestjs/mapped-types';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { OmittableNotNull } from '../common/omittable-not-null';
import { CreateUserDto } from './create-user.dto';

// Passwords change only through /auth/password and admin reset.
// department/designation stay optional and nullable (inherited @IsOptional).
export class UpdateUserDto extends OmitType(CreateUserDto, [
  'password',
  'name',
  'email',
] as const) {
  @OmittableNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @OmittableNotNull()
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(150)
  email?: string;
}
