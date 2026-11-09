import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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