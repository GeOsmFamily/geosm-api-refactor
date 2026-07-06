import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ConfigDbUseCase');

export interface DbConfigResult {
  host: string;
  port: number;
  database: string;
  user: string;
  ssl: boolean;
}

export class ConfigDbUseCase {
  async execute(): Promise<DbConfigResult> {
    const url = new URL(config.DATABASE_URL);
    logger.debug('Database configuration retrieved', { host: url.hostname, database: url.pathname.slice(1).split('?')[0] });
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1).split('?')[0],
      user: url.username,
      ssl: url.searchParams.get('sslmode') === 'require',
    };
  }
}
