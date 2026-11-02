
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './asset.entity';
import { User } from '../users/user.entity';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, User])],
  providers: [
    AssetsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AssetsController],
})
export class AssetsModule {}
