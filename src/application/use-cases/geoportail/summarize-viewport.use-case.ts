import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';

export interface ViewportSummary {
  layerCount: number;
  totalFeatureCount: number;
  perLayer: { name: string; featureCount: number }[];
  narrative?: string;
}

/**
 * Résumé de la vue courante : agrège les statistiques (PostGISService.getLayerStats) de
 * toutes les couches actuellement actives sur la carte, puis les transforme en un court
 * paragraphe via Gemini ("12 établissements de santé, dont 2 maternités..."). Aucune
 * agrégation multi-couches n'existait avant (GetLayerStatsUseCase est strictement par
 * couche) - cette classe boucle simplement dessus.
 */
export class SummarizeViewportUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(layerIds: string[]): Promise<ViewportSummary> {
    const perLayer: { name: string; featureCount: number }[] = [];

    for (const layerId of layerIds) {
      const layer = await this.layerRepository.findById(layerId);
      if (!layer?.schemaName || !layer.tableName) continue;
      try {
        const stats = await this.postGISService.getLayerStats(layer.schemaName, layer.tableName);
        perLayer.push({ name: layer.name, featureCount: stats.featureCount });
      } catch (error) {
        logger.warn('Statistiques indisponibles pour une couche du résumé de vue', {
          layerId, error: error instanceof Error ? error.message : error,
        });
      }
    }

    const totalFeatureCount = perLayer.reduce((sum, l) => sum + l.featureCount, 0);
    const summary: ViewportSummary = { layerCount: perLayer.length, totalFeatureCount, perLayer };

    if (perLayer.length === 0) return summary;

    try {
      const layerList = perLayer.map((l) => `${l.name} (${l.featureCount})`).join(', ');
      const narrative = await this.geminiService.generateText(
        `Voici les couches actuellement affichées sur une carte, avec leur nombre d'entités : ${layerList}. `
        + `Rédige en français un court paragraphe (2-3 phrases) qui met en avant ce qui est notable dans cette `
        + `zone pour un public non-technique (élu local, ONG). Ne répète pas mécaniquement les chiffres, donne `
        + `une lecture qualitative (ex: couverture faible/forte, thématiques dominantes).`,
      );
      summary.narrative = narrative;
    } catch (error) {
      logger.warn('Synthèse narrative de la vue courante indisponible (Gemini)', {
        error: error instanceof Error ? error.message : error,
      });
    }

    return summary;
  }
}
