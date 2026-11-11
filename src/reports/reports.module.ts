
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';
import { AssetAssignmentHistory } from '../assets/asset-assignment-history.entity';
import { Maintenance } from '../maintenance/maintenance.entity';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      User,
      AssetAssignmentHistory,
      Maintenance,
    ]),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class ReportsModule {}
