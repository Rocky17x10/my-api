import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';

import { EnvironmentVariables } from '../config/env.validation';
import { RefreshToken } from './refresh-token.entity';
import { RefreshTokensService } from './refresh-tokens.service';

function setup(row: Partial<RefreshToken> | null, claimed: number) {
  const repo = {
    findOneBy: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockResolvedValue({ affected: claimed }),
    insert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: () => 7 } as unknown as ConfigService<
    EnvironmentVariables,
    true
  >;
  const service = new RefreshTokensService(
    repo as unknown as Repository<RefreshToken>,
    config,
  );
  return { service, repo };
}

const future = () => new Date(Date.now() + 60_000);

describe('RefreshTokensService', () => {
  it('starts a session with a random token stored only as a hash', async () => {
    const { service, repo } = setup(null, 0);

    const issued = await service.startSession(5);

    const stored = repo.insert.mock.calls[0][0];
    expect(issued.token).toHaveLength(43); // 32 bytes, base64url
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.tokenHash).not.toContain(issued.token);
    expect(stored.userId).toBe(5);
  });

  it('rotates a valid token within the same family', async () => {
    const { service, repo } = setup(
      { id: 1, userId: 5, familyId: 'fam', expiresAt: future() },
      1,
    );

    const { userId, next } = await service.rotate('old-token');

    expect(userId).toBe(5);
    expect(next.token).not.toBe('old-token');
    expect(repo.insert.mock.calls[0][0].familyId).toBe('fam');
  });

  it('revokes the whole family when a used token comes back', async () => {
    const { service, repo } = setup(
      { id: 1, userId: 5, familyId: 'fam', expiresAt: future() },
      0, // already revoked: the claim updates nothing
    );

    await expect(service.rotate('reused')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(repo.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ familyId: 'fam' }),
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('refuses unknown and expired tokens', async () => {
    await expect(setup(null, 0).service.rotate('nope')).rejects.toThrow(
      UnauthorizedException,
    );

    const expired = setup(
      { id: 1, userId: 5, familyId: 'fam', expiresAt: new Date(Date.now() - 1) },
      1,
    );
    await expect(expired.service.rotate('old')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(expired.repo.insert).not.toHaveBeenCalled();
  });
});
