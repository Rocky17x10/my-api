import { Test, TestingModule } from '@nestjs/testing';
import { AssetRequestsService } from './asset-requests.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AssetRequest } from './asset-request.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../support-tickets/notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

describe('AssetRequestsService', () => {
  let service: AssetRequestsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetRequestsService,
        { provide: getRepositoryToken(AssetRequest), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: ActivityLogsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AssetRequestsService>(AssetRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
