import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService, GeoJSONFeature } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetFeatureUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(layerId: string, featureId: number): Promise<GeoJSONFeature> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    const feature = await this.postGISService.getFeatureById(layer.schemaName, layer.tableName, featureId);
    if (!feature) throw new NotFoundError('Feature', String(featureId));
    return feature;
  }
}
