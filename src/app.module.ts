
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { AssetRequestsModule } from './asset-requests/asset-requests.module';
import { AssetReturnsModule } from './asset-returns/asset-returns.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { ReportsModule } from './reports/reports.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'my-api',
    }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'appuser',
      password: process.env.DB_PASSWORD,
      database: 'myapp_db',
      autoLoadEntities: true,
      synchronize: false,
    }),

    UsersModule,
    AuthModule,
    AssetsModule,
    AssetRequestsModule,
    AssetReturnsModule,
    MaintenanceModule,
    DashboardModule,
    SupportTicketsModule,
    ReportsModule,
    ActivityLogsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
