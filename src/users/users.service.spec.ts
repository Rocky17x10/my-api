import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { ConfigService } from '@nestjs/config';
import { EntityManager } from 'typeorm';

describe('UsersService', () => {
  let service: UsersService;
  // Runs the transaction callback at once with a manager whose save echoes the entity.
  const manager = {
    getRepository: () => ({ save: (user: User) => Promise.resolve(user) }),
  } as unknown as EntityManager;
  const usersRepository = {
    findOneBy: jest.fn(),
    manager: {
      transaction: (work: (m: EntityManager) => Promise<unknown>) =>
        work(manager),
    },
  };
  const activityLogs = { createLog: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: usersRepository },
        { provide: ActivityLogsService, useValue: activityLogs },
        { provide: ConfigService, useValue: { get: () => 12 } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('writes the update log inside the same transaction (SEC-14)', async () => {
    usersRepository.findOneBy.mockResolvedValue({
      id: 2,
      role: 'user',
      name: 'E',
      email: 'e@x.co',
    } as User);

    await service.update(2, 'New name', undefined, undefined, undefined, {
      userId: 1,
      role: 'admin',
    });

    expect(activityLogs.createLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EMPLOYEE_UPDATED' }),
      manager,
    );
  });
});
