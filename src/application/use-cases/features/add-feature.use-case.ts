import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type {
  PostGISService,
  GeoJSONFeature,
} from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AddFeatureUseCase');

export interface AddFeatureInput {
  layerId: string;
  geometry: Record<string, unknown>;
  properties: Record<string, unknown>;
}

export class AddFeatureUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(input: AddFeatureInput): Promise<{ id: number }> {
    const layer = await this.layerRepository.findById(input.layerId);
    if (!layer) throw new NotFoundError('Layer', input.layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', input.layerId);
    }

    const feature: GeoJSONFeature = {
      type: 'Feature',
      geometry: input.geometry,
      properties: input.properties,
    };

    const id = await this.postGISService.insertFeature(layer.schemaName, layer.tableName, feature);
    logger.info('Feature added', { layerId: input.layerId, featureId: id });
    return { id };
  }
}
