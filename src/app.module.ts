
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createObserveModule } from '@nestjs/observe';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.validation';
import { databaseOptions } from './database/database.options';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AssetsModule } from './assets/assets.module';
import { AssetRequestsModule } from './asset-requests/asset-requests.module';
import { AssetReturnsModule } from './asset-returns/asset-returns.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),

    // forRoot above has already loaded .env into process.env; Observe is only
    // registered when real credentials are configured.
    ...(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET
      ? [
          ObserveModule.forRoot({
            appKey: process.env.OBSERVE_APP_KEY,
            appSecret: process.env.OBSERVE_APP_SECRET,
            serviceId: 'my-api',
          }),
        ]
      : []),

    TypeOrmModule.forRootAsync({
      // ConfigModule.forRoot above has loaded and validated .env into process.env.
      useFactory: () => ({
        ...databaseOptions(validateEnv(process.env)),
        autoLoadEntities: true,
      }),
    }),

    UsersModule,
    AuthModule,
    AssetsModule,
    AssetRequestsModule,
    AssetReturnsModule,
    MaintenanceModule,
    DashboardModule,
    SupportTicketsModule,
    NotificationsModule,
    ReportsModule,
    ActivityLogsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
