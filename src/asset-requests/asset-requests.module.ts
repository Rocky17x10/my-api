
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetRequestsController } from './asset-requests.controller';
import { AssetRequestsService } from './asset-requests.service';
import { AssetRequest } from './asset-request.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AssetRequest, User])],
  controllers: [AssetRequestsController],
  providers: [AssetRequestsService],
})
export class AssetRequestsModule {}
