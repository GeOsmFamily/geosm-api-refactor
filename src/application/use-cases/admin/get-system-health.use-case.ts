import { PrismaClient } from '@prisma/client';
import { RedisService } from '../../../infrastructure/cache/redis.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetSystemHealthUseCase');

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
    } catch (error) {
      database = 'down';
      logger.error('Database health check failed', { error: error instanceof Error ? error.message : String(error) });
    }

    try {
      const result = await this.redisService.getClient().ping();
      redis = result === 'PONG' ? 'up' : 'down';
    } catch (error) {
      redis = 'down';
      logger.error('Redis health check failed', { error: error instanceof Error ? error.message : String(error) });
    }

    return { database, redis };
  }
}
