import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { Type } from '@nestjs/common';

import { ActivityLogsController } from '../activity-logs/activity-logs.controller';
import { AssetRequestsController } from '../asset-requests/asset-requests.controller';
import { AssetReturnsController } from '../asset-returns/asset-returns.controller';
import { AssetsController } from '../assets/assets.controller';
import { DashboardController } from '../dashboard/dashboard.controller';
import { MaintenanceController } from '../maintenance/maintenance.controller';
import { ReportsController } from '../reports/reports.controller';
import { NotificationsController } from '../support-tickets/notifications/notifications.controller';
import { SupportTicketsController } from '../support-tickets/support-tickets.controller';
import { UsersController } from '../users/users.controller';
import { AuthController } from './auth.controller';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const CONTROLLERS: Type[] = [
  ActivityLogsController,
  AssetRequestsController,
  AssetReturnsController,
  AssetsController,
  AuthController,
  DashboardController,
  MaintenanceController,
  NotificationsController,
  ReportsController,
  SupportTicketsController,
  UsersController,
];

function routes(controller: Type) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: proto[name] as object }))
    .filter(({ handler }) => Reflect.hasMetadata(PATH_METADATA, handler));
}

const guardsOf = (target: object): unknown[] =>
  (Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? [];

// SEC-11: RolesGuard denies routes without @Roles, so every such route must declare its roles.
describe('route access declarations', () => {
  it('every route behind RolesGuard declares @Roles', () => {
    const missing: string[] = [];

    for (const controller of CONTROLLERS) {
      for (const { name, handler } of routes(controller)) {
        const guarded = [...guardsOf(controller), ...guardsOf(handler)].includes(RolesGuard);
        const roles =
          (Reflect.getMetadata(ROLES_KEY, handler) as unknown[] | undefined) ??
          (Reflect.getMetadata(ROLES_KEY, controller) as unknown[] | undefined);
        if (guarded && !roles?.length) missing.push(`${controller.name}.${name}`);
      }
    }

    expect(missing).toEqual([]);
  });
});
