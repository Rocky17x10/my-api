import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThan, Repository } from 'typeorm';

import { EnvironmentVariables } from '../config/env.validation';
import { RefreshToken } from './refresh-token.entity';

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokensService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly tokens: Repository<RefreshToken>,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  /** New login: a new token family. Also drops the user's expired rows. */
  async startSession(userId: number): Promise<IssuedRefreshToken> {
    await this.tokens.delete({ userId, expiresAt: LessThan(new Date()) });
    return this.issue(userId, randomUUID());
  }

  /** Swaps a valid token for a new one in the same family. */
  async rotate(
    token: string,
  ): Promise<{ userId: number; next: IssuedRefreshToken }> {
    const row = await this.tokens.findOneBy({ tokenHash: hashToken(token) });
    if (!row || row.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    // Atomic claim: of two requests using the same token, only one revokes the row.
    const claim = await this.tokens.update(
      { id: row.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (claim.affected !== 1) {
      // A used token came back: someone holds a copy. End that whole session.
      await this.revokeFamily(row.familyId);
      throw new UnauthorizedException('Session expired');
    }

    return { userId: row.userId, next: await this.issue(row.userId, row.familyId) };
  }

  /** Logout: ends the session the token belongs to. Unknown tokens are ignored. */
  async endSession(token: string): Promise<void> {
    const row = await this.tokens.findOneBy({ tokenHash: hashToken(token) });
    if (row) await this.revokeFamily(row.familyId);
  }

  /** Password change or reset: ends every session of the user. */
  async endAllSessions(userId: number, manager?: EntityManager): Promise<void> {
    const tokens = manager?.getRepository(RefreshToken) ?? this.tokens;
    await tokens.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.tokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async issue(
    userId: number,
    familyId: string,
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const days = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.tokens.insert({
      userId,
      familyId,
      tokenHash: hashToken(token),
      expiresAt,
    });
    return { token, expiresAt };
  }
}
