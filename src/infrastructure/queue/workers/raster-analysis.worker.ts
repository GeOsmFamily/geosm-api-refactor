import type { Job } from 'bullmq';
import { Prisma, type PrismaClient } from '@prisma/client';
import { logger } from '../../observability/logger.js';
import type { PostGISService } from '../../database/postgis.service.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { FindAdminBoundariesByLevelUseCase } from '../../../application/use-cases/geoportail/find-admin-boundaries-by-level.use-case.js';

type RasterAnalysisWorkerDeps = {
  prisma: PrismaClient;
  postGISService: PostGISService;
  layerRepository: ILayerRepository;
  findAdminBoundariesByLevelUseCase: FindAdminBoundariesByLevelUseCase;
};

interface RasterAnalysisJobData {
  resultId: string;
  layerId: string;
  type: 'global' | 'zonal';
  instanceId: string;
}

export function createRasterAnalysisProcessor(deps: RasterAnalysisWorkerDeps) {
  return async function processRasterAnalysis(job: Job): Promise<void> {
    const { resultId, layerId, type, instanceId } = job.data as RasterAnalysisJobData;
    logger.info("Traitement du job d'analyse raster", { jobId: job.id, resultId, type });

    try {
      await deps.prisma.rasterAnalysisResult.update({
        where: { id: resultId },
        data: { status: 'PROCESSING' },
      });

      const layer = await deps.layerRepository.findById(layerId);
      if (!layer || !layer.schemaName || !layer.tableName) {
        throw new Error('Layer introuvable ou sans table raster associée');
      }

      let result: unknown;
      if (type === 'global') {
        result = await deps.postGISService.getRasterStats(layer.schemaName, layer.tableName);
      } else {
        const zones = await deps.findAdminBoundariesByLevelUseCase.execute(instanceId);
        result = await deps.postGISService.getZonalStats(
          layer.schemaName,
          layer.tableName,
          zones.map((z) => ({ id: z.id, name: z.name, geojson: JSON.stringify(z.geojson) })),
        );
      }

      await deps.prisma.rasterAnalysisResult.update({
        where: { id: resultId },
        data: { status: 'COMPLETED', result: result as Prisma.InputJsonValue },
      });
      logger.info("Job d'analyse raster terminé", { jobId: job.id, resultId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Job d'analyse raster échoué", { jobId: job.id, resultId, error: message });
      await deps.prisma.rasterAnalysisResult
        .update({ where: { id: resultId }, data: { status: 'FAILED', error: message } })
        .catch(() => undefined);
      throw error;
    }
  };
}
