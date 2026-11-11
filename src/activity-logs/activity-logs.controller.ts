
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ActivityLogsService } from './activity-logs.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
export class ActivityLogsController {
  constructor(
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  // Get activity logs with optional filters
  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogsService.findAll({
      action,
      entityType,
      search,
      from,
      to,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }
}
