import { applyDecorators } from '@nestjs/common';
import { IsByteLength, IsString, MinLength } from 'class-validator';

export const MIN_PASSWORD_LENGTH = 12;

/** bcrypt ignores everything after 72 bytes, so longer passwords are refused, not cut. */
export function IsAcceptablePassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(MIN_PASSWORD_LENGTH),
    IsByteLength(0, 72, { message: '$property must be at most 72 bytes' }),
  );
}
