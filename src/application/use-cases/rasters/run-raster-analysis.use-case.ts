import type { PrismaClient } from '@prisma/client';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RunRasterAnalysisUseCase');

export type RasterAnalysisType = 'global' | 'zonal' | 'custom';

export interface RunRasterAnalysisResult {
  resultId: string;
}

/**
 * Déclenche une analyse raster asynchrone (voir plan "Analyse raster") : crée la ligne de suivi
 * (status PENDING) puis pousse le job dans la queue BullMQ dédiée - le worker
 * (raster-analysis.worker.ts) fait le vrai calcul et met à jour cette même ligne.
 */
export class RunRasterAnalysisUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly layerRepository: ILayerRepository,
    private readonly queueService: QueueService,
  ) {}

  async execute(
    layerId: string,
    type: RasterAnalysisType,
    adminLevel?: number,
    geometry?: Record<string, unknown>,
  ): Promise<RunRasterAnalysisResult> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);

    const isRaster = layer.metadata?.['source'] === 'raster';
    if (!isRaster || !layer.schemaName || !layer.tableName) {
      throw new ValidationError("Cette couche n'est pas un raster analysable", {});
    }
    if (type === 'custom' && !geometry) {
      throw new ValidationError("Une géométrie est requise pour une analyse de type 'custom'", {});
    }

    const created = await this.prisma.rasterAnalysisResult.create({
      data: { layerId, type, status: 'PENDING' },
    });

    await this.queueService.addJob('raster-analysis', 'run', {
      resultId: created.id,
      layerId,
      type,
      instanceId: layer.instanceId,
      adminLevel,
      geometry,
    });

    logger.info('Raster analysis job enqueued', { resultId: created.id, layerId, type });
    return { resultId: created.id };
  }
}
