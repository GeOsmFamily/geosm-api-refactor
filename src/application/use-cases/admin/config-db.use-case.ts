import { config } from '../../../config/env.config.js';

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
    return {
      host: url.hostname,
      port: parseInt(url.port || '5432'),
      database: url.pathname.slice(1).split('?')[0],
      user: url.username,
      ssl: url.searchParams.get('sslmode') === 'require',
    };
  }
}
