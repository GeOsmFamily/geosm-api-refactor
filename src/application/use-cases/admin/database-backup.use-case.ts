import { spawn } from 'node:child_process';
import { createWriteStream, createReadStream } from 'node:fs';
import { stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface DatabaseBackupResult {
  key: string;
  sizeBytes: number;
  deletedOldBackups: number;
}

const BACKUP_PREFIX = 'backups/postgres/';

/**
 * Backup planifié de Postgres (voir QueueService.addRepeatableJob, enregistré dans server.ts) :
 * `pg_dump -F c` (format "custom", déjà compressé par pg_dump lui-même, restaurable
 * sélectivement via pg_restore). Écrit d'abord sur disque local (fichier temporaire) puis
 * upload le fichier complet (taille connue) vers MinIO - PAS de streaming direct process -> HTTP.
 *
 * Deux versions précédentes ont échoué en conditions réelles sur cette base (qui contient les
 * tables OSM/SRTM volumineuses, pas seulement les tables métier) : (1) tout bufferiser en
 * mémoire (`Buffer.concat`), et (2) streamer via un PassThrough vers un upload MinIO sans
 * taille connue - les deux ont fait dépasser la limite mémoire du conteneur (1024M) et
 * déclenché un OOM kill (confirmé via `docker events` : `container oom` puis `exitCode=137`,
 * reproduit deux fois). Le client MinIO semble buffériser en interne quand la taille n'est pas
 * fournie à l'avance. Écrire sur disque d'abord (borné par l'espace disque, pas la RAM) puis
 * uploader avec une taille explicite (`fs.stat`) évite complètement ce chemin de code.
 *
 * IMPORTANT : un backup qui n'a jamais été restauré n'est pas un backup fiable - voir
 * docs/deploiement.md pour la procédure de restauration testée (pg_restore depuis ce même
 * format).
 */
export class DatabaseBackupUseCase {
  constructor(
    private readonly storageService: MinioStorageService,
    private readonly databaseUrl: string,
    private readonly retentionDays: number,
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
      return { key, sizeBytes: stats.size, deletedOldBackups };
    } finally {
      await unlink(tmpFile).catch(() => {
        // Fichier déjà absent (pg_dump a échoué avant de rien écrire) - rien à nettoyer.
      });
    }
  }

  private dumpToFile(tmpFile: string): Promise<void> {
    // Prisma ajoute ?schema=public à DATABASE_URL (convention propre à Prisma) - pg_dump ne
    // reconnaît pas ce paramètre de requête libpq et rejette l'URI entière si on le laisse
    // (confirmé en testant réellement la commande, pas seulement en la lisant).
    const pgDumpUrl = this.databaseUrl.split('?')[0];
    return new Promise((resolve, reject) => {
      const proc = spawn('pg_dump', [pgDumpUrl, '-F', 'c']);
      const fileStream = createWriteStream(tmpFile);
      proc.stdout.pipe(fileStream);

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`pg_dump a échoué (code ${code}): ${stderr}`));
          return;
        }
        resolve();
      });
    });
  }

  private async applyRetention(): Promise<number> {
    const files = await this.storageService.listFiles(BACKUP_PREFIX);
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const expired = files.filter((f) => f.lastModified.getTime() < cutoff);

    for (const file of expired) {
      await this.storageService.deleteFile(file.key);
      logger.info('Backup Postgres expiré supprimé', {
        key: file.key,
        lastModified: file.lastModified,
      });
    }

    return expired.length;
  }
}
