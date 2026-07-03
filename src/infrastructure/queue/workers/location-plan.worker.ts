import type { Job } from 'bullmq';
import { readFile, stat, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../../observability/logger.js';
import type { QGISProjectService } from '../../qgis/qgis-project.service.js';
import type { PaperSize, PlanOrientation } from '../../../domain/enums.js';

export interface LocationPlanJobData {
  locationPlanId: string;
  userId: string;
  lon: number;
  lat: number;
  title: string;
  description?: string;
  landmark?: string;
  scale?: number;
  paperSize: PaperSize;
  orientation: PlanOrientation;
  instanceBbox?: number[] | null;
}

type LocationPlanWorkerDeps = {
  locationPlanRepository: { update: (id: string, data: Record<string, unknown>) => Promise<unknown> };
  storageService: { uploadFile: (key: string, data: Buffer) => Promise<string> };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
  qgisProjectService: QGISProjectService;
};

export function createLocationPlanProcessor(deps: LocationPlanWorkerDeps) {
  return async function processLocationPlan(job: Job<LocationPlanJobData>): Promise<void> {
    const { locationPlanId, userId, lon, lat, title, description, landmark, scale, paperSize, orientation, instanceBbox } = job.data;
    logger.info('Processing location plan', { locationPlanId, lon, lat });

    const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
    await mkdir(tmpDir, { recursive: true });
    const outputFileName = `plan_${locationPlanId}.pdf`;
    const outputPath = path.join(tmpDir, outputFileName);

    try {
      await deps.locationPlanRepository.update(locationPlanId, { status: 'PROCESSING', startedAt: new Date() });
      deps.notificationService.notifyUser(userId, 'location-plan:progress', { locationPlanId, status: 'PROCESSING', progress: 10 });

      const result = await deps.qgisProjectService.generateLocationPlan(lon, lat, outputPath, {
        title,
        description,
        landmark,
        scale,
        paperSize: paperSize.toLowerCase() as 'a4' | 'a3',
        orientation: orientation.toLowerCase() as 'portrait' | 'landscape',
        instanceBbox: instanceBbox && instanceBbox.length === 4 ? (instanceBbox as [number, number, number, number]) : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'La génération PyQGIS a échoué sans message d’erreur');
      }

      deps.notificationService.notifyUser(userId, 'location-plan:progress', { locationPlanId, status: 'PROCESSING', progress: 80 });

      const fileBuffer = await readFile(outputPath);
      const fileStats = await stat(outputPath);
      const minioKey = `location-plans/${locationPlanId}/${outputFileName}`;
      await deps.storageService.uploadFile(minioKey, fileBuffer);

      await deps.locationPlanRepository.update(locationPlanId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        filePath: minioKey,
        fileSize: fileStats.size,
      });

      deps.notificationService.notifyUser(userId, 'location-plan:completed', {
        locationPlanId, status: 'COMPLETED', filePath: minioKey, fileSize: fileStats.size,
      });

      logger.info('Location plan completed', { locationPlanId, fileSize: fileStats.size });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Location plan generation failed', { locationPlanId, error: errorMessage });

      await deps.locationPlanRepository.update(locationPlanId, { status: 'FAILED', errorMessage, completedAt: new Date() });
      deps.notificationService.notifyUser(userId, 'location-plan:failed', { locationPlanId, status: 'FAILED', error: errorMessage });

      throw error;
    } finally {
      try { await unlink(outputPath); } catch { /* ignore */ }
    }
  };
}
