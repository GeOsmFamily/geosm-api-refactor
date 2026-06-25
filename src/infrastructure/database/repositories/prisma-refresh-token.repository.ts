import { PrismaClient, RefreshToken as PrismaRefreshToken } from '@prisma/client';
import { IRefreshTokenRepository, CreateRefreshTokenData } from '../../../domain/repositories/refresh-token.repository.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByToken(token: string): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({ where: { token } });
    return record ? this.toDomain(record) : null;
  }

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const record = await this.prisma.refreshToken.create({
      data: {
        id: data.id,
        token: data.token,
        userId: data.userId,
        family: data.family,
        expiresAt: data.expiresAt,
        revokedAt: data.revokedAt,
        replacedByToken: data.replacedByToken,
      },
    });
    return this.toDomain(record);
  }

  async revokeByToken(token: string, replacedByToken?: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { token },
      data: {
        revokedAt: new Date(),
        replacedByToken: replacedByToken ?? null,
      },
    });
  }

  async revokeAllByFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  private toDomain(record: PrismaRefreshToken): RefreshToken {
    return new RefreshToken({
      id: record.id,
      token: record.token,
      userId: record.userId,
      family: record.family,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      replacedByToken: record.replacedByToken,
      createdAt: record.createdAt,
    });
  }
}
