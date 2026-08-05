import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface CountFeaturesInGeometryResult {
  count: number;
}

/**
 * Compte les entités d'une couche vectorielle intersectant une géométrie arbitraire - voir
 * PostGISService.countFeaturesInGeometry. Sert l'outil `count_features_in_geometry` de
 * l'assistant IA (plan "refonte Statistiques" du 2026-08-05), typiquement enchaîné après un
 * `compute_geometry` (ex: "combien d'hôpitaux dans cette intersection ?").
 */
export class CountFeaturesInGeometryUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(
    layerId: string,
    geometry: Record<string, unknown>,
  ): Promise<CountFeaturesInGeometryResult> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    const count = await this.postGISService.countFeaturesInGeometry(
      layer.schemaName,
      layer.tableName,
      geometry,
    );
    return { count };
  }
}
