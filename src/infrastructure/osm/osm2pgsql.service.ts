import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config/env.config.js';
import { logger } from '../observability/logger.js';

const execAsync = promisify(exec);

export interface Osm2pgsqlOptions {
  slim?: boolean;
  append?: boolean;
  styleFile?: string;
  cache?: number;
  flatNodes?: string;
  extraArgs?: string[];
}

export class Osm2pgsqlService {
  private readonly dbUrl: string;

  constructor() {
    this.dbUrl = config.DATABASE_URL;
  }

  private buildConnectionArgs(): string[] {
    const url = new URL(this.dbUrl);
    return [
      '-d', url.pathname.slice(1).split('?')[0],
      '-H', url.hostname,
      '-P', url.port || '5432',
      '-U', url.username,
    ];
  }

  async importFile(pbfPath: string, options: Osm2pgsqlOptions = {}): Promise<{ success: boolean; message: string }> {
    const args: string[] = ['osm2pgsql'];

    if (options.append) {
      args.push('--append');
    } else {
      args.push('--create');
    }

    if (options.slim !== false) {
      args.push('--slim');
    }

    if (options.cache) {
      args.push('-C', String(options.cache));
    }

    if (options.styleFile) {
      args.push('-S', options.styleFile);
    }

    if (options.flatNodes) {
      args.push('--flat-nodes', options.flatNodes);
    }

    if (options.extraArgs) {
      args.push(...options.extraArgs);
    }

    args.push(...this.buildConnectionArgs());
    args.push(pbfPath);

    const cmd = args.map(a => a.includes(' ') ? `"${a}"` : a).join(' ');
    logger.info('Running osm2pgsql import', { pbfPath, mode: options.append ? 'append' : 'create' });

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: 3600000, // 1 hour
        env: { ...process.env, PGPASSWORD: new URL(this.dbUrl).password },
      });
      logger.info('osm2pgsql import completed', { stdout: stdout.trim(), stderr: stderr.trim() });
      return { success: true, message: 'Import completed successfully' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('osm2pgsql import failed', { error: msg });
      throw new Error(`osm2pgsql import failed: ${msg}`);
    }
  }

  async updateData(pbfPath: string, options: Osm2pgsqlOptions = {}): Promise<{ success: boolean; message: string }> {
    return this.importFile(pbfPath, { ...options, append: true });
  }
}
