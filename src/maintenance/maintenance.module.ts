import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Maintenance } from './maintenance.entity';
import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';

import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Maintenance,
      Asset,
      User,
    ]),
  ],
  controllers: [MaintenanceController],
  providers: [
    MaintenanceService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class MaintenanceModule {}