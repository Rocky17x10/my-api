
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';

import { AssetRequestsService } from './asset-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

import {
  AssetRequestQueryDto,
  CreateAssetRequestDto,
  ReviewAssetRequestDto,
} from './dto/asset-request.dto';
import { CurrentUser } from '../common/current-user.decorator';

@Controller('asset-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetRequestsController {
  constructor(
    private readonly assetRequestsService: AssetRequestsService,
  ) {}

  // Employees submit a new request
  @Post()
  @AnyRole()
  create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateAssetRequestDto,
  ) {
    return this.assetRequestsService.create(
      user.userId,
      body,
    );
  }

  // Employees view their own requests
  @Get('my')
  @AnyRole()
  findMyRequests(
    @CurrentUser() user: AuthUser,
    @Query() query: AssetRequestQueryDto,
  ) {
    return this.assetRequestsService.findMyRequests(
      user.userId,
      query,
    );
  }

  // Admins view all requests
  @Get()
  @Roles('super_admin', 'admin')
  findAll(@Query() query: AssetRequestQueryDto) {
    return this.assetRequestsService.findAll(query);
  }

  // Admins approve or reject a request
  @Patch(':id/review')
  @Roles('super_admin', 'admin')
  review(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Body() body: ReviewAssetRequestDto,
  ) {
    return this.assetRequestsService.review(
      id,
      user.userId,
      body.status,
      body.adminNote,
    );
  }
}
