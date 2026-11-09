import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { MaintenanceService } from './maintenance.service';

import {
  CreateMaintenanceDto,
  CompleteMaintenanceDto,
} from './maintenance.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
  ) {}

  @Post()
  create(@Body() dto: CreateMaintenanceDto, @Req() req: any) {
    return this.maintenanceService.create(dto, req.user.userId);
  }

  @Get()
  findAll() {
    return this.maintenanceService.findAll();
  }

  @Get('asset/:assetId')
  findByAsset(@Param('assetId', ParseIntPipe) assetId: number) {
    return this.maintenanceService.findByAsset(assetId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.maintenanceService.findOne(id);
  }

  @Patch(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteMaintenanceDto,
    @Req() req: any,
  ) {
    return this.maintenanceService.complete(
      id,
      dto,
      req.user.userId,
    );
  }
}