import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Asset } from './asset.entity';
import { AssetAssignmentHistory } from './asset-assignment-history.entity';
import { User } from '../users/user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssetListQueryDto } from './dto/asset.dto';

describe('AssetsService', () => {
  let service: AssetsService;
  const assetsRepository = { manager: { transaction: jest.fn() }, createQueryBuilder: jest.fn() };
  const activityLogs = { createLog: jest.fn() };
  const notifications = { createNotification: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: assetsRepository },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(AssetAssignmentHistory), useValue: {} },
        { provide: ActivityLogsService, useValue: activityLogs },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('assignAsset writes the notification and log with the transaction manager', async () => {
    const manager = {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        name: 'Laptop',
        assetTag: 'LT-5',
        status: 'available',
        assignedTo: null,
      }),
      // Employee first, then the administrator.
      findOneBy: jest
        .fn()
        .mockResolvedValueOnce({ id: 2, name: 'Employee', isActive: true })
        .mockResolvedValueOnce({ id: 1, name: 'Admin' }),
      create: jest.fn(),
      save: jest.fn(),
    };
    assetsRepository.manager.transaction.mockImplementation(
      (work: (m: typeof manager) => Promise<unknown>) => work(manager),
    );

    await service.assignAsset(5, 2, 1);

    expect(notifications.createNotification).toHaveBeenCalledWith(
      2,
      'Asset Assigned',
      'Laptop (LT-5) has been assigned to you.',
      'asset_assigned',
      5,
      manager,
    );
    expect(notifications.createNotification.mock.calls[0][5]).toBe(manager);
    expect(activityLogs.createLog.mock.calls[0][1]).toBe(manager);
  });

  it('an employee lists only their own assets; only the admin list searches the assignee', async () => {
    const builder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      alias: 'asset',
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    assetsRepository.createQueryBuilder.mockReturnValue(builder);
    const query = Object.assign(new AssetListQueryDto(), { search: 'dell', status: 'assigned' });

    await service.findAssignedToUser(7, query);
    const own = builder.andWhere.mock.calls.map((call) => String(call[0]));
    expect(builder.andWhere).toHaveBeenCalledWith('assignedTo.id = :assigneeId', { assigneeId: 7 });
    expect(builder.andWhere).toHaveBeenCalledWith('asset.status = :status', { status: 'assigned' });
    expect(own.some((sql) => sql.includes('assignedTo.name'))).toBe(false);
    expect(builder.orderBy).toHaveBeenCalledWith('asset.id', 'DESC');

    builder.andWhere.mockClear();
    await service.findAll(query);
    const all = builder.andWhere.mock.calls.map((call) => String(call[0]));
    expect(all.some((sql) => sql.includes('assignedTo.id'))).toBe(false);
    expect(all.some((sql) => sql.includes('assignedTo.name LIKE :search'))).toBe(true);
  });
});
