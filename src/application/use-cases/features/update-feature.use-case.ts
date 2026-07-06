import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateFeatureUseCase');

export interface UpdateFeatureInput {
  layerId: string;
  featureId: number;
  geometry?: Record<string, unknown>;
  properties?: Record<string, unknown>;
}

export class UpdateFeatureUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(input: UpdateFeatureInput): Promise<void> {
    const layer = await this.layerRepository.findById(input.layerId);
    if (!layer) throw new NotFoundError('Layer', input.layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', input.layerId);
    }

    // Verify feature exists
    const existing = await this.postGISService.getFeatureById(layer.schemaName, layer.tableName, input.featureId);
    if (!existing) throw new NotFoundError('Feature', String(input.featureId));

    if (input.geometry) {
      await this.postGISService.updateFeatureGeometry(
        layer.schemaName, layer.tableName, input.featureId, JSON.stringify(input.geometry),
      );
    }

    if (input.properties && Object.keys(input.properties).length > 0) {
      await this.postGISService.updateFeatureAttributes(
        layer.schemaName, layer.tableName, input.featureId, input.properties,
      );
    }
    logger.info('Feature updated', { layerId: input.layerId, featureId: input.featureId });
  }
}
