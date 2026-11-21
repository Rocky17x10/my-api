import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';

import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { AuthUser } from './jwt.strategy';
import { RefreshTokensService } from './refresh-tokens.service';

// Wraps the real bcrypt so calls can be counted (its ESM export cannot be spied on).
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');
  return { ...actual, compare: jest.fn(actual.compare) };
});

const actor = (role: AuthUser['role'], userId = 1): AuthUser => ({
  userId,
  role,
  email: 'actor@example.com',
  name: 'Actor',
  department: null,
  designation: null,
  mustChangePassword: false,
});

describe('AuthService', () => {
  let service: AuthService;
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    setPassword: jest.fn(),
  };
  const refreshTokens = {
    startSession: jest.fn(),
    endAllSessions: jest.fn(),
  };
  // Runs the transaction callback at once with a stand-in manager.
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: (work: (m: EntityManager) => Promise<unknown>) => work(manager),
  } as unknown as DataSource;

  beforeEach(async () => {
    jest.clearAllMocks();
    refreshTokens.startSession.mockResolvedValue({
      token: 't',
      expiresAt: new Date(),
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        {
          provide: JwtService,
          useValue: { signAsync: () => Promise.resolve('jwt') },
        },
        { provide: RefreshTokensService, useValue: refreshTokens },
        { provide: ActivityLogsService, useValue: { createLog: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: () => 4 } },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('runs bcrypt for unknown emails too (no timing difference)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login('ghost@example.com', 'whatever'),
    ).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).toHaveBeenCalledTimes(1);
  });

  it('logs in with the right password and starts a session', async () => {
    const password = await bcrypt.hash('correct horse', 4);
    users.findByEmail.mockResolvedValue({
      id: 7,
      password,
      role: 'user',
      isActive: true,
    } as User);

    const session = await service.login('a@example.com', 'correct horse');

    expect(session.accessToken).toBe('jwt');
    expect(session.user).not.toHaveProperty('password');
    expect(refreshTokens.startSession).toHaveBeenCalledWith(7);
  });

  it('refuses a deactivated account even with the right password', async () => {
    const password = await bcrypt.hash('correct horse', 4);
    users.findByEmail.mockResolvedValue({ id: 7, password, isActive: false } as User);

    await expect(service.login('a@example.com', 'correct horse')).rejects.toThrow(
      ForbiddenException,
    );
    expect(refreshTokens.startSession).not.toHaveBeenCalled();
  });

  it('deactivation ends every session of the account', async () => {
    users.findOne.mockResolvedValue({ id: 2, role: 'user', name: 'E', email: 'e@x.co' } as User);
    const setActive = jest.fn();
    Object.assign(users, { setActive });

    await service.setActive(actor('admin'), 2, false);

    expect(setActive).toHaveBeenCalledWith(2, false, manager);
    expect(refreshTokens.endAllSessions).toHaveBeenCalledWith(2, manager);
  });

  it('answers a wrong current password with 400, not 401', async () => {
    const password = await bcrypt.hash('current-password', 4);
    users.findByEmail.mockResolvedValue({ id: 1, password } as User);

    await expect(
      service.changePassword(actor('user'), 'wrong', 'a-new-long-password'),
    ).rejects.toThrow(BadRequestException);
    expect(users.setPassword).not.toHaveBeenCalled();
  });

  describe('resetPassword', () => {
    it('lets an admin reset an employee and forces a change', async () => {
      users.findOne.mockResolvedValue({ id: 2, role: 'user' } as User);

      const { temporaryPassword } = await service.resetPassword(
        actor('admin'),
        2,
      );

      expect(temporaryPassword.length).toBeGreaterThanOrEqual(16);
      expect(users.setPassword).toHaveBeenCalledWith(
        2,
        temporaryPassword,
        true,
        manager,
      );
      expect(refreshTokens.endAllSessions).toHaveBeenCalledWith(2, manager);
    });

    it.each([
      ['an admin resets another admin', 'admin', 'admin'],
      ['anyone resets the super admin', 'super_admin', 'super_admin'],
    ] as const)('refuses when %s', async (_case, actorRole, targetRole) => {
      users.findOne.mockResolvedValue({ id: 2, role: targetRole } as User);

      await expect(
        service.resetPassword(actor(actorRole), 2),
      ).rejects.toThrow(ForbiddenException);
      expect(users.setPassword).not.toHaveBeenCalled();
    });

    it('lets the super admin reset an admin', async () => {
      users.findOne.mockResolvedValue({ id: 2, role: 'admin' } as User);

      await service.resetPassword(actor('super_admin'), 2);
      expect(users.setPassword).toHaveBeenCalled();
    });

    it('refuses a reset of your own account', async () => {
      users.findOne.mockResolvedValue({ id: 1, role: 'admin' } as User);

      await expect(service.resetPassword(actor('admin', 1), 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
