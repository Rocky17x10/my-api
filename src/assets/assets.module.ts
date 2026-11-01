
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { Asset } from './asset.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, User])],
  providers: [AssetsService],
  controllers: [AssetsController],
})
export class AssetsModule {}
