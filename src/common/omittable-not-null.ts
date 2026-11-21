import { ValidateIf } from 'class-validator';

/**
 * For PATCH bodies: the field may be left out, but `null` is validated (and refused by
 * @IsString etc.). @IsOptional would let null through, and a non-strict MySQL/MariaDB
 * silently stores '' in a NOT NULL column.
 */
export const OmittableNotNull = () =>
  ValidateIf((_object: object, value: unknown) => value !== undefined);
