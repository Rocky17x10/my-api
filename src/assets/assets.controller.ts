
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';

import { AssetsService } from './assets.service';
import { AssetListQueryDto, AssignAssetDto, CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
  ) {}

  // Get all assets
  @Get()
  @AnyRole()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: AssetListQueryDto,
  ) {
    const { userId, role } = user;

    if (role === 'super_admin' || role === 'admin') {
      return this.assetsService.findAll(query);
    }

    return this.assetsService.findAssignedToUser(userId, query);
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
    @CurrentUser() user: AuthUser,
  ) {
    const { userId, role } = user;

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
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.create(
      dto,
      user.userId,
    );
  }

  // Update an asset and record the administrator
  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.update(
      id,
      dto,
      user.userId,
    );
  }

  // Assign an asset and record the administrator
  @Post(':id/assign')
  @Roles('super_admin', 'admin')
  assignAsset(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.assignAsset(
      id,
      dto.userId,
      user.userId,
    );
  }

  // Unassign an asset and record the administrator
  @Patch(':id/unassign')
  @Roles('super_admin', 'admin')
  unassignAsset(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.unassignAsset(
      id,
      user.userId,
    );
  }
}
