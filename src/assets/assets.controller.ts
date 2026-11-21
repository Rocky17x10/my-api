
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
import { AssignAssetDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';

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
  @AnyRole()
  findAll(@Req() req: AuthenticatedRequest) {
    const { userId, role } = req.user;

    if (role === 'super_admin' || role === 'admin') {
      return this.assetsService.findAll();
    }

    return this.assetsService.findAssignedToUser(userId);
  }

  // Get complete history of a specific asset
  @Get(':id/history')
  @Roles('super_admin', 'admin')
  findAssetHistory(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.assetsService.findAssetHistory(id);
  }

  // Get assignment history of a specific employee
  @Get('history/employee/:employeeId')
  @AnyRole()
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
  create(
    @Body() dto: CreateAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.create(
      dto,
      req.user.userId,
    );
  }

  // Update an asset and record the administrator
  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.update(
      id,
      dto,
      req.user.userId,
    );
  }

  // Assign an asset and record the administrator
  @Post(':id/assign')
  @Roles('super_admin', 'admin')
  assignAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAssetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.assignAsset(
      id,
      dto.userId,
      req.user.userId,
    );
  }

  // Unassign an asset and record the administrator
  @Patch(':id/unassign')
  @Roles('super_admin', 'admin')
  unassignAsset(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.assetsService.unassignAsset(
      id,
      req.user.userId,
    );
  }
}
