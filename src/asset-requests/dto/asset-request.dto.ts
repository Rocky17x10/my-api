import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PageQueryDto } from '../../common/pagination';
import { AssetRequestStatus } from '../asset-request.entity';

export class CreateAssetRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  itemName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ReviewAssetRequestDto {
  @IsIn(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}

export class AssetRequestQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['createdAt', 'itemName', 'status'])
  sort: 'createdAt' | 'itemName' | 'status' = 'createdAt';

  @IsOptional()
  @IsEnum(AssetRequestStatus)
  status?: AssetRequestStatus;
}
