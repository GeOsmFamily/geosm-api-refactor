import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService, LayerStats } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export class GetLayerStatsUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(layerId: string): Promise<LayerStats> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    return this.postGISService.getLayerStats(layer.schemaName, layer.tableName);
  }
}
