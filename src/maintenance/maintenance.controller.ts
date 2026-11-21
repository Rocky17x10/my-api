import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../auth/jwt.strategy';

import { MaintenanceService } from './maintenance.service';

import {
  CreateMaintenanceDto,
  CompleteMaintenanceDto,
  MaintenanceQueryDto,
} from './maintenance.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
  ) {}

  @Post()
  create(@Body() dto: CreateMaintenanceDto, @CurrentUser() user: AuthUser) {
    return this.maintenanceService.create(dto, user.userId);
  }

  @Get()
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.maintenanceService.findAll(query);
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
    @CurrentUser() user: AuthUser,
  ) {
    return this.maintenanceService.complete(
      id,
      dto,
      user.userId,
    );
  }
}