import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssetRequestsService } from './asset-requests.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AssetRequest, AssetRequestStatus } from './asset-request.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

describe('AssetRequestsService', () => {
  let service: AssetRequestsService;
  // Runs the transaction callback at once with a stand-in manager.
  const update = jest.fn().mockResolvedValue({ affected: 1 });
  const manager = {
    getRepository: () => ({ update }),
  } as unknown as EntityManager;
  const requestRepository = {
    findOne: jest.fn(),
    manager: {
      transaction: (work: (m: EntityManager) => Promise<unknown>) =>
        work(manager),
    },
  };
  const userRepository = { findOneBy: jest.fn() };
  const notifications = { createNotification: jest.fn() };
  const activityLogs = { createLog: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetRequestsService,
        { provide: getRepositoryToken(AssetRequest), useValue: requestRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: NotificationsService, useValue: notifications },
        { provide: ActivityLogsService, useValue: activityLogs },
      ],
    }).compile();

    service = module.get<AssetRequestsService>(AssetRequestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('review writes the log and the notification in the claim transaction (SEC-14)', async () => {
    requestRepository.findOne.mockResolvedValue({
      id: 7,
      itemName: 'Laptop',
      status: AssetRequestStatus.PENDING,
      requestedBy: { id: 2, name: 'Employee' },
    });
    userRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Admin' });

    await service.review(7, 1, AssetRequestStatus.APPROVED);

    expect(activityLogs.createLog).toHaveBeenCalledTimes(1);
    expect(activityLogs.createLog.mock.calls[0][1]).toBe(manager);
    expect(notifications.createNotification).toHaveBeenCalledTimes(1);
    expect(notifications.createNotification.mock.calls[0][5]).toBe(manager);
  });

  it('reviewing an already-reviewed request is a 409, in the pre-check and the lost race', async () => {
    userRepository.findOneBy.mockResolvedValue({ id: 1, name: 'Admin' });

    requestRepository.findOne.mockResolvedValue({
      id: 7,
      status: AssetRequestStatus.APPROVED,
      requestedBy: { id: 2, name: 'Employee' },
    });
    await expect(service.review(7, 1, AssetRequestStatus.APPROVED)).rejects.toThrow(
      new ConflictException('This request has already been reviewed.'),
    );

    requestRepository.findOne.mockResolvedValue({
      id: 7,
      status: AssetRequestStatus.PENDING,
      requestedBy: { id: 2, name: 'Employee' },
    });
    update.mockResolvedValueOnce({ affected: 0 });
    await expect(service.review(7, 1, AssetRequestStatus.APPROVED)).rejects.toThrow(
      ConflictException,
    );
    expect(activityLogs.createLog).not.toHaveBeenCalled();
  });
});
