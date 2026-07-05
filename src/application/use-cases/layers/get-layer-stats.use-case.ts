import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService, LayerStats } from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface LayerStatsWithNarrative extends LayerStats {
  narrative?: string;
}

export class GetLayerStatsUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(layerId: string, withNarrative = false): Promise<LayerStatsWithNarrative> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    const stats = await this.postGISService.getLayerStats(layer.schemaName, layer.tableName);
    if (!withNarrative) return stats;

    // La synthèse IA est un bonus, jamais bloquant : une clé Gemini absente/un quota dépassé
    // ne doit pas faire échouer une requête de statistiques qui fonctionnait déjà sans IA.
    try {
      const narrative = await this.geminiService.generateText(
        `Décris en une phrase concise et naturelle (en français, pour un géoportail public, sans jargon) `
        + `les statistiques suivantes d'une couche cartographique nommée "${layer.name}" : `
        + `${stats.featureCount} entités recensées`
        + (stats.totalArea !== null ? `, superficie totale ${stats.totalArea.toFixed(2)} km²` : '')
        + (stats.totalLength !== null ? `, longueur totale ${stats.totalLength.toFixed(2)} km` : '')
        + `. Donne un aperçu qualitatif, ne répète pas mécaniquement les chiffres.`,
      );
      return { ...stats, narrative };
    } catch (error) {
      logger.warn('Synthèse narrative des statistiques indisponible (Gemini)', {
        layerId, error: error instanceof Error ? error.message : error,
      });
      return stats;
    }
  }
}
