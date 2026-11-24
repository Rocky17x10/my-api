import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PageQueryDto } from '../common/pagination';
import type { MaintenanceStatus } from './maintenance.entity';

export class CreateMaintenanceDto {
  @IsNumber()
  @Min(1)
  assetId: number;

  @IsString()
  @IsNotEmpty()
  maintenanceType: string;

  @IsString()
  @IsNotEmpty()
  problemDescription: string;

  @IsOptional()
  @IsString()
  serviceProvider?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class CompleteMaintenanceDto {
  @IsOptional()
  @IsString()
  repairDetails?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsString()
  serviceProvider?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
export class MaintenanceQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(['createdAt', 'startDate', 'status'])
  sort: 'createdAt' | 'startDate' | 'status' = 'createdAt';

  @IsOptional()
  @IsIn(['in_progress', 'completed'])
  status?: MaintenanceStatus;
}
