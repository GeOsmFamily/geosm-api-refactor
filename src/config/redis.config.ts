import { config } from './env.config.js';

export const redisConfig = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  db: config.REDIS_DB,
  maxRetriesPerRequest: null as null,
};
