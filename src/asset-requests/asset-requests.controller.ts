
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

import { AssetRequestsService } from './asset-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AnyRole, Roles } from '../auth/roles.decorator';
import type { AuthUser } from '../auth/jwt.strategy';

type AuthenticatedRequest = { user: AuthUser };
import {
  CreateAssetRequestDto,
  ReviewAssetRequestDto,
} from './dto/asset-request.dto';

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
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateAssetRequestDto,
  ) {
    return this.assetRequestsService.create(
      req.user.userId,
      body,
    );
  }

  // Employees view their own requests
  @Get('my')
  @AnyRole()
  findMyRequests(@Req() req: AuthenticatedRequest) {
    return this.assetRequestsService.findMyRequests(
      req.user.userId,
    );
  }

  // Admins view all requests
  @Get()
  @Roles('super_admin', 'admin')
  findAll() {
    return this.assetRequestsService.findAll();
  }

  // Admins approve or reject a request
  @Patch(':id/review')
  @Roles('super_admin', 'admin')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() body: ReviewAssetRequestDto,
  ) {
    return this.assetRequestsService.review(
      id,
      req.user.userId,
      body.status,
      body.adminNote,
    );
  }
}
