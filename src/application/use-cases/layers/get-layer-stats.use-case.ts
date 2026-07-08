import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type {
  PostGISService,
  LayerStats,
} from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { logger } from '../../../infrastructure/observability/logger.js';
import { localize } from '../../utils/localize.js';

export interface LayerStatsWithNarrative extends LayerStats {
  narrative?: string;
}

const NARRATIVE_PROMPT_BY_LANG: Record<string, (layerName: string, stats: LayerStats) => string> = {
  fr: (layerName, stats) =>
    `Décris en une phrase concise et naturelle (en français, pour un géoportail public, sans jargon) ` +
    `les statistiques suivantes d'une couche cartographique nommée "${layerName}" : ` +
    `${stats.featureCount} entités recensées` +
    (stats.totalArea !== null ? `, superficie totale ${stats.totalArea.toFixed(2)} km²` : '') +
    (stats.totalLength !== null ? `, longueur totale ${stats.totalLength.toFixed(2)} km` : '') +
    `. Donne un aperçu qualitatif, ne répète pas mécaniquement les chiffres.`,
  en: (layerName, stats) =>
    `Describe in one concise, natural sentence (in English, for a public geoportal, no jargon) ` +
    `the following statistics for a map layer named "${layerName}": ` +
    `${stats.featureCount} features recorded` +
    (stats.totalArea !== null ? `, total area ${stats.totalArea.toFixed(2)} km²` : '') +
    (stats.totalLength !== null ? `, total length ${stats.totalLength.toFixed(2)} km` : '') +
    `. Give a qualitative overview, don't just repeat the numbers.`,
};

export class GetLayerStatsUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(
    layerId: string,
    withNarrative = false,
    lang = 'fr',
  ): Promise<LayerStatsWithNarrative> {
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
      const buildPrompt = NARRATIVE_PROMPT_BY_LANG[lang] ?? NARRATIVE_PROMPT_BY_LANG['fr'];
      const narrative = await this.geminiService.generateText(
        buildPrompt(localize(layer.name, lang), stats),
      );
      return { ...stats, narrative };
    } catch (error) {
      logger.warn('Synthèse narrative des statistiques indisponible (Gemini)', {
        layerId,
        error: error instanceof Error ? error.message : error,
      });
      return stats;
    }
  }
}
