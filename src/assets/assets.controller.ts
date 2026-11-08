
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';

import type { Request } from 'express';

import { AssetsService } from './assets.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    role: 'super_admin' | 'admin' | 'user';
  };
}

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
  ) {}

  // Get all assets
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const { userId, role } = req.user;

    if (role === 'super_admin' || role === 'admin') {
      return this.assetsService.findAll();
    }

    return this.assetsService.findAssignedToUser(userId);
  }

  // Get complete history of a specific asset
  // Only Admin and Super Admin can access
  @Get(':id/history')
  @Roles('super_admin', 'admin')
  findAssetHistory(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.assetsService.findAssetHistory(id);
  }

  // Get assignment history of a specific employee
  // Employees can view only their own history
  @Get('history/employee/:employeeId')
  findEmployeeHistory(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const { userId, role } = req.user;

    if (
      role === 'user' &&
      userId !== employeeId
    ) {
      throw new ForbiddenException(
        'You can only view your own assignment history.',
      );
    }

    return this.assetsService.findEmployeeHistory(
      employeeId,
    );
  }

  // Create an asset
  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() assetData: any) {
    return this.assetsService.create(assetData);
  }

  // Update an asset
  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() assetData: any,
  ) {
    return this.assetsService.update(id, assetData);
  }

  // Assign an asset and record the administrator
  @Post(':id/assign')
  @Roles('super_admin', 'admin')
  assignAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body('userId') userId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.assignAsset(
      id,
      userId,
      req.user.userId,
    );
  }

  // Unassign an asset and record its return date
  @Patch(':id/unassign')
  @Roles('super_admin', 'admin')
  unassignAsset(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.assetsService.unassignAsset(id);
  }
}
