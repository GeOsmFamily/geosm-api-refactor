import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import type { IEmailService } from '../../services/email.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface DatabaseBackupResult {
  key: string;
  sizeBytes: number;
  deletedOldBackups: number;
}

const BACKUP_PREFIX = 'backups/postgres/';

export class DatabaseBackupUseCase {
  constructor(
    private readonly storageService: MinioStorageService,
    private readonly databaseUrl: string,
    private readonly retentionDays: number,
    private readonly emailService?: IEmailService,
    private readonly alertEmailTo?: string,
  ) {}

  async execute(): Promise<DatabaseBackupResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${BACKUP_PREFIX}geosm-${timestamp}.dump`;
    const tmpFile = join(tmpdir(), `geosm-backup-${timestamp}.dump`);

    logger.info('Backup Postgres démarré', { key, tmpFile });
    try {
      await this.dumpToFile(tmpFile);
      const stats = await stat(tmpFile);
      await this.storageService.uploadFile(
        key,
        createReadStream(tmpFile),
        'application/octet-stream',
        stats.size,
      );
      logger.info('Backup Postgres terminé', { key, sizeBytes: stats.size });

      const deletedOldBackups = await this.applyRetention();
      const result: DatabaseBackupResult = { key, sizeBytes: stats.size, deletedOldBackups };

      if (this.emailService && this.alertEmailTo) {
        try {
          await this.emailService.sendBackupReportEmail(this.alertEmailTo, result);
        } catch (emailErr) {
          logger.warn('Failed to send backup report email', { error: emailErr });
        }
      }

      return result;
    } finally {
      await unlink(tmpFile).catch(() => {
        // Fichier déjà absent - rien à nettoyer.
      });
    }
  }

  private async dumpToFile(outputPath: string): Promise<void> {
    const url = new URL(this.databaseUrl);
    const host = url.hostname;
    const port = url.port || '5432';
    const user = url.username;
    const password = decodeURIComponent(url.password);
    const dbName = url.pathname.slice(1);

    return new Promise((resolve, reject) => {
      const child = spawn(
        'pg_dump',
        ['-h', host, '-p', port, '-U', user, '-F', 'c', '-f', outputPath, dbName],
        { env: { ...process.env, PGPASSWORD: password } },
      );

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start pg_dump: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  private async applyRetention(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const objects = await this.storageService.listFiles(BACKUP_PREFIX);
    let count = 0;

    for (const obj of objects) {
      if (obj.lastModified && obj.lastModified < cutoffDate) {
        await this.storageService.deleteFile(obj.key);
        count++;
      }
    }

    logger.info('Backup retention applied', {
      retentionDays: this.retentionDays,
      deletedCount: count,
    });
    return count;
  }
}
