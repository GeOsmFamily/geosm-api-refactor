import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteFeatureUseCase');

export class DeleteFeatureUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(layerId: string, featureId: number): Promise<void> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    // Verify feature exists
    const existing = await this.postGISService.getFeatureById(layer.schemaName, layer.tableName, featureId);
    if (!existing) throw new NotFoundError('Feature', String(featureId));

    await this.postGISService.deleteFeature(layer.schemaName, layer.tableName, featureId);
    logger.info('Feature deleted', { layerId, featureId });
  }
}
