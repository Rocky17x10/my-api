
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetReturnsController } from './asset-returns.controller';
import { AssetReturnsService } from './asset-returns.service';

import { AssetReturn } from '../assets/asset-return.entity';
import { Asset } from '../assets/asset.entity';
import { AssetAssignmentHistory } from '../assets/asset-assignment-history.entity';
import { User } from '../users/user.entity';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetReturn,
      Asset,
      AssetAssignmentHistory,
      User,
    ]),
  ],
  controllers: [AssetReturnsController],
  providers: [
    AssetReturnsService,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AssetReturnsModule {}
