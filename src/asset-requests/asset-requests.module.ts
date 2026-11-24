
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AssetRequest } from './asset-request.entity';
import { AssetRequestsController } from './asset-requests.controller';
import { AssetRequestsService } from './asset-requests.service';

import { User } from '../users/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AssetRequest, User]),
    NotificationsModule,
    ActivityLogsModule,
  ],
  controllers: [AssetRequestsController],
  providers: [AssetRequestsService],
})
export class AssetRequestsModule {}
