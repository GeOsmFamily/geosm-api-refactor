import { PrismaClient } from '@prisma/client';
import { RedisService } from '../../../infrastructure/cache/redis.service.js';

export interface SystemHealth {
  database: 'up' | 'down';
  redis: 'up' | 'down';
}

export class GetSystemHealthUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redisService: RedisService,
  ) {}

  async execute(): Promise<SystemHealth> {
    let database: 'up' | 'down' = 'down';
    let redis: 'up' | 'down' = 'down';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }

    try {
      const result = await this.redisService.getClient().ping();
      redis = result === 'PONG' ? 'up' : 'down';
    } catch {
      redis = 'down';
    }

    return { database, redis };
  }
}
