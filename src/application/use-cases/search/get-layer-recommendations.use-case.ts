import type { PrismaAnalyticsRepository } from '../../../infrastructure/database/repositories/prisma-analytics.repository.js';
import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { localize } from '../../utils/localize.js';

export interface LayerRecommendation {
  id: string;
  name: string;
  description: string | null;
  coUserCount: number;
}

/**
 * "Les utilisateurs qui ont activé X ont aussi activé Y" - reommandation par co-occurrence
 * à partir des événements "layer_activated" déjà trackés (voir MapLayerService.addLayer
 * côté frontend). La mécanique est du SQL pur (self-join, voir
 * PrismaAnalyticsRepository.getCoActivatedLayers) - aucun appel Gemini nécessaire ici.
 */
export class GetLayerRecommendationsUseCase {
  constructor(
    private readonly analyticsRepository: PrismaAnalyticsRepository,
    private readonly layerRepository: ILayerRepository,
  ) {}

  async execute(layerId: string, instanceId: string, limit = 5, lang = 'fr'): Promise<LayerRecommendation[]> {
    const coActivated = await this.analyticsRepository.getCoActivatedLayers(layerId, instanceId, limit);

    const recommendations: LayerRecommendation[] = [];
    for (const r of coActivated) {
      const layer = await this.layerRepository.findById(r.layerId);
      if (layer) recommendations.push({ id: layer.id, name: localize(layer.name, lang), description: localize(layer.description, lang) || null, coUserCount: r.coUserCount });
    }
    return recommendations;
  }
}
