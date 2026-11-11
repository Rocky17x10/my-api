import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('assets')
  getAssets(@Query() query: Record<string, string>) {
    return this.reportsService.getAssets(query);
  }

  @Get('employees')
  getEmployees() {
    return this.reportsService.getEmployees();
  }

  @Get('departments')
  getDepartments() {
    return this.reportsService.getDepartments();
  }

  @Get('assigned-assets')
  getAssignedAssets(@Query() query: Record<string, string>) {
    return this.reportsService.getAssignedAssets(query);
  }

  @Get('available-assets')
  getAvailableAssets(@Query() query: Record<string, string>) {
    return this.reportsService.getAvailableAssets(query);
  }

  @Get('maintenance')
  getMaintenance(@Query() query: Record<string, string>) {
    return this.reportsService.getMaintenance(query);
  }

  @Get('assignment-history')
  getAssignmentHistory() {
    return this.reportsService.getAssignmentHistory();
  }
}