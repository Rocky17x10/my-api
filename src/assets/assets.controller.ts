
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

  // All authenticated users can view assets.
  // Admins see all assets; regular users see only their own.
  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    const { userId, role } = req.user;

    if (role === 'super_admin' || role === 'admin') {
      return this.assetsService.findAll();
    }

    return this.assetsService.findAssignedToUser(userId);
  }

  // Only Admin and Super Admin can create assets.
  @Post()
  @Roles('super_admin', 'admin')
  create(@Body() assetData: any) {
    return this.assetsService.create(assetData);
  }

  // Only Admin and Super Admin can edit assets.
  @Patch(':id')
  @Roles('super_admin', 'admin')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() assetData: any,
  ) {
    return this.assetsService.update(id, assetData);
  }
}
