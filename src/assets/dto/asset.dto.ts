import { OmitType } from '@nestjs/mapped-types';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import { OmittableNotNull } from '../../common/omittable-not-null';

// Lengths match the columns in asset.entity.ts. id, assignedTo and timestamps are not
// fields here, so the global ValidationPipe rejects them (SEC-03).
export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  assetTag: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  serialNumber?: string | null;

  // "assigned" is only reachable through POST /assets/:id/assign.
  @IsOptional()
  @IsIn(['available', 'maintenance', 'retired'])
  status?: 'available' | 'maintenance' | 'retired';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'purchaseDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true })
  purchaseDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

// Nullable fields keep the inherited @IsOptional; the NOT NULL ones may be left out but not nulled.
export class UpdateAssetDto extends OmitType(CreateAssetDto, [
  'status',
  'assetTag',
  'name',
  'category',
] as const) {
  @OmittableNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  assetTag?: string;

  @OmittableNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @OmittableNotNull()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  category?: string;

  // The edit form sends the current status back; "assigned" is accepted when unchanged.
  @IsOptional()
  @IsIn(['available', 'assigned', 'maintenance', 'retired'])
  status?: 'available' | 'assigned' | 'maintenance' | 'retired';
}

export class AssignAssetDto {
  /** The employee who receives the asset. */
  @IsInt()
  @Min(1)
  userId: number;
}
