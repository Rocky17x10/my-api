
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';
import { AssetRequest } from '../asset-requests/asset-request.entity';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      User,
      AssetRequest,
    ]),
  ],

  controllers: [DashboardController],

  providers: [
    DashboardService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class DashboardModule {}
