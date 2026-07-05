import type { Job } from 'bullmq';
import { logger } from '../../observability/logger.js';
import type { ScheduledOsmImportUseCase } from '../../../application/use-cases/admin/scheduled-osm-import.use-case.js';

type ScheduledOsmImportWorkerDeps = {
  scheduledOsmImportUseCase: ScheduledOsmImportUseCase;
};

export function createScheduledOsmImportProcessor(deps: ScheduledOsmImportWorkerDeps) {
  return async function processScheduledOsmImport(job: Job): Promise<void> {
    logger.info('Traitement du job d\'import OSM programmé', { jobId: job.id });
    const result = await deps.scheduledOsmImportUseCase.execute();
    logger.info('Job d\'import OSM programmé terminé', { jobId: job.id, ...result });
  };
}
