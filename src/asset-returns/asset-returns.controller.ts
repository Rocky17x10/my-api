
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';

import { AssetReturnsService } from './asset-returns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

import {
  AssetReturnQueryDto,
  CreateAssetReturnDto,
  ReviewAssetReturnDto,
} from './dto/asset-return.dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('asset-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetReturnsController {
  constructor(
    private readonly assetReturnsService: AssetReturnsService,
  ) {}

  // Employee: submit return request
  @Post()
  @AnyRole()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAssetReturnDto,
  ) {
    return this.assetReturnsService.create(
      user.userId,
      body.assetId,
      body.employeeNote,
    );
  }

  // Employee: view own return requests
  @Get('my')
  @AnyRole()
  findMyReturns(
    @CurrentUser() user: AuthUser,
    @Query() query: AssetReturnQueryDto,
  ) {
    return this.assetReturnsService.findMyReturns(
      user.userId,
      query,
    );
  }

  // Admin and Super Admin: view all requests
  @Get()
  @Roles('admin', 'super_admin')
  findAllReturns(@Query() query: AssetReturnQueryDto) {
    return this.assetReturnsService.findAllReturns(query);
  }

  // Admin and Super Admin: review a return
  @Patch(':id/review')
  @Roles('admin', 'super_admin')
  review(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewAssetReturnDto,
  ) {
    return this.assetReturnsService.review(
      id,
      user.userId,
      body,
    );
  }
}
