
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  UseGuards,
  Param,
  ParseIntPipe,
} from '@nestjs/common';

import { AssetReturnsService } from './asset-returns.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('asset-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetReturnsController {
  constructor(
    private readonly assetReturnsService: AssetReturnsService,
  ) {}

  // Employee: submit return request
  @Post()
  create(
    @Req() req: any,
    @Body() body: {
      assetId: number;
      employeeNote?: string;
    },
  ) {
    return this.assetReturnsService.create(
      req.user.userId,
      Number(body.assetId),
      body.employeeNote,
    );
  }

  // Employee: view own return requests
  @Get('my')
  findMyReturns(@Req() req: any) {
    return this.assetReturnsService.findMyReturns(
      req.user.userId,
    );
  }

  // Admin and Super Admin: view all requests
  @Get()
  @Roles('admin', 'super_admin')
  findAllReturns() {
    return this.assetReturnsService.findAllReturns();
  }

  // Admin and Super Admin: review a return
  @Patch(':id/review')
  @Roles('admin', 'super_admin')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: {
      status: 'approved' | 'rejected';
      condition?: 'good' | 'damaged' | 'needs_maintenance';
      adminNote?: string;
    },
  ) {
    return this.assetReturnsService.review(
      id,
      req.user.userId,
      body,
    );
  }
}
