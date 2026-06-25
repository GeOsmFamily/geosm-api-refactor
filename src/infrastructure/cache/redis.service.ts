import Redis from 'ioredis';
import { redisConfig } from '../../config/redis.config.js';
import { logger } from '../observability/logger.js';
import { cacheHitsTotal, cacheMissesTotal } from '../observability/metrics.js';

export class RedisService {
  private client: Redis;

  constructor() {
    this.client = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', (error) => {
      logger.error('Redis error', { error: error.message });
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    const result = await this.client.get(key);
    if (result !== null) {
      cacheHitsTotal.inc();
    } else {
      cacheMissesTotal.inc();
    }
    return result;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}
