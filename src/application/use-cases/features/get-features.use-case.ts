import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type {
  PostGISService,
  GeoJSONFeatureCollection,
} from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetFeaturesUseCase');

export interface GetFeaturesInput {
  layerId: string;
  bbox?: [number, number, number, number];
  limit?: number;
  offset?: number;
  where?: string;
}

export class GetFeaturesUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(input: GetFeaturesInput): Promise<GeoJSONFeatureCollection> {
    logger.debug('Getting features', { layerId: input.layerId, bbox: input.bbox });
    const layer = await this.layerRepository.findById(input.layerId);
    if (!layer) throw new NotFoundError('Layer', input.layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', input.layerId);
    }

    return this.postGISService.queryFeatures({
      schema: layer.schemaName,
      table: layer.tableName,
      bbox: input.bbox,
      limit: input.limit,
      offset: input.offset,
      where: input.where,
    });
  }
}
