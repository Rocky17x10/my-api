
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityLog } from './activity-log.entity';
import { ActivityLogsService } from './activity-logs.service';
import { ActivityLogsController } from './activity-logs.controller';

import { User } from '../users/user.entity';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ActivityLog,
      User,
    ]),
  ],
  controllers: [
    ActivityLogsController,
  ],
  providers: [
    ActivityLogsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    ActivityLogsService,
  ],
})
export class ActivityLogsModule {}
