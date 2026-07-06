import type { Job } from 'bullmq';
import { logger } from '../../observability/logger.js';
import type { DatabaseBackupUseCase } from '../../../application/use-cases/admin/database-backup.use-case.js';

type DatabaseBackupWorkerDeps = {
  databaseBackupUseCase: DatabaseBackupUseCase;
};

export function createDatabaseBackupProcessor(deps: DatabaseBackupWorkerDeps) {
  return async function processDatabaseBackup(job: Job): Promise<void> {
    logger.info('Traitement du job de backup Postgres', { jobId: job.id });
    try {
      const result = await deps.databaseBackupUseCase.execute();
      logger.info('Job de backup Postgres terminé', { jobId: job.id, ...result });
    } catch (error) {
      // Un backup manqué est sérieux (contrairement à un import OSM manqué) - log en error
      // (pas warn) pour que ça remonte comme une alerte distincte en observabilité.
      logger.error('Job de backup Postgres échoué', { jobId: job.id, error: error instanceof Error ? error.message : error });
      throw error;
    }
  };
}
