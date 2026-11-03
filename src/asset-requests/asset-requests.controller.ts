
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
import { Roles } from '../auth/roles.decorator';

@Controller('asset-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetRequestsController {
  constructor(
    private readonly assetRequestsService: AssetRequestsService,
  ) {}

  // Employees submit a new request
  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      itemName: string;
      category: string;
      reason: string;
    },
  ) {
    return this.assetRequestsService.create(
      req.user.userId,
      body,
    );
  }

  // Employees view their own requests
  @Get('my')
  findMyRequests(@Req() req: any) {
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
    @Req() req: any,
    @Body()
    body: {
      status: string;
      adminNote?: string;
    },
  ) {
    return this.assetRequestsService.review(
      id,
      req.user.userId,
      body.status,
      body.adminNote,
    );
  }
}
