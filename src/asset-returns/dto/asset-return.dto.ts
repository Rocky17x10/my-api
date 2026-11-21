import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAssetReturnDto {
  @IsInt()
  @Min(1)
  assetId: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  employeeNote?: string;
}

export class ReviewAssetReturnDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  // Required when approving; the service checks that rule.
  @IsOptional()
  @IsIn(['good', 'damaged', 'needs_maintenance'])
  condition?: 'good' | 'damaged' | 'needs_maintenance';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
