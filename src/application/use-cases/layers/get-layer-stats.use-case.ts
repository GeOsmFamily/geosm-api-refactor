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

/** Densité approximative (entités/km²) d'une emprise bbox - sert de point de comparaison dans
 * le prompt IA ("zone visible" vs "toute la couche"), pas une mesure géodésique précise : une
 * approximation planaire à la latitude du centre suffit pour donner un ordre de grandeur dans
 * une phrase de synthèse (voir plan "refonte Statistiques" du 2026-08-05). */
function bboxAreaKm2(bbox: [number, number, number, number] | null): number | null {
  if (!bbox) return null;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const centerLat = (minLat + maxLat) / 2;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const widthM = Math.abs(maxLon - minLon) * metersPerDegLon;
  const heightM = Math.abs(maxLat - minLat) * metersPerDegLat;
  return (widthM * heightM) / 1_000_000;
}

/** Prompt "descriptif" (pas de comparaison possible sans une deuxième mesure de référence) -
 * utilisé quand aucune emprise n'est fournie (ex. appel depuis le catalogue de couches, hors
 * carte). */
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

/** Prompt "comparatif/conclusif" - utilisé dès qu'une emprise est fournie : la réponse doit
 * situer la zone visible par rapport à l'ensemble de la couche (proportion, densité relative),
 * pas seulement énumérer ses propres chiffres. C'est le changement central demandé le
 * 2026-08-05 ("l'analyse de l'IA doit prendre en compte la zone zoomée ... faire des analyses
 * et déductions"), partagé avec le narratif raster (voir raster-analysis.worker.ts /
 * statistics-tool.component.ts qui suit la même logique de comparaison côté client). */
const COMPARATIVE_PROMPT_BY_LANG: Record<
  string,
  (layerName: string, zone: LayerStats, whole: LayerStats) => string
> = {
  fr: (layerName, zone, whole) => {
    const zoneDensity = bboxAreaKm2(zone.bbox);
    const share =
      whole.featureCount > 0 ? Math.round((zone.featureCount / whole.featureCount) * 100) : null;
    return (
      `Tu analyses la couche "${layerName}" sur un géoportail. Dans la zone actuellement visible ` +
      `à l'écran : ${zone.featureCount} entités` +
      (zoneDensity
        ? ` (≈ ${(zone.featureCount / zoneDensity).toFixed(1)} entités/km² sur cette zone)`
        : '') +
      (zone.totalArea !== null ? `, superficie ${zone.totalArea.toFixed(2)} km²` : '') +
      (zone.totalLength !== null ? `, longueur ${zone.totalLength.toFixed(2)} km` : '') +
      `. Sur l'ensemble de la couche : ${whole.featureCount} entités au total` +
      (share !== null ? ` (la zone visible en représente environ ${share}%)` : '') +
      `. Rédige une phrase concise et naturelle (en français, sans jargon, pour un géoportail ` +
      `public) qui SITUE la zone visible par rapport à l'ensemble - conclus (dense/peu dense, ` +
      `au-dessus/en-dessous de la moyenne...), ne te contente pas d'énumérer les chiffres.`
    );
  },
  en: (layerName, zone, whole) => {
    const zoneDensity = bboxAreaKm2(zone.bbox);
    const share =
      whole.featureCount > 0 ? Math.round((zone.featureCount / whole.featureCount) * 100) : null;
    return (
      `You are analyzing the "${layerName}" layer on a geoportal. In the area currently visible ` +
      `on screen: ${zone.featureCount} features` +
      (zoneDensity
        ? ` (≈ ${(zone.featureCount / zoneDensity).toFixed(1)} features/km² in this area)`
        : '') +
      (zone.totalArea !== null ? `, area ${zone.totalArea.toFixed(2)} km²` : '') +
      (zone.totalLength !== null ? `, length ${zone.totalLength.toFixed(2)} km` : '') +
      `. Across the whole layer: ${whole.featureCount} features total` +
      (share !== null ? ` (the visible area accounts for about ${share}% of it)` : '') +
      `. Write one concise, natural sentence (in English, no jargon, for a public geoportal) that ` +
      `POSITIONS the visible area relative to the whole layer - conclude (dense/sparse, above/` +
      `below average...), don't just list the numbers.`
    );
  },
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
    bbox?: [number, number, number, number],
  ): Promise<LayerStatsWithNarrative> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new NotFoundError('Spatial table for layer', layerId);
    }

    const stats = await this.postGISService.getLayerStats(layer.schemaName, layer.tableName, bbox);
    if (!withNarrative) return stats;

    // La synthèse IA est un bonus, jamais bloquant : une clé Gemini absente/un quota dépassé
    // ne doit pas faire échouer une requête de statistiques qui fonctionnait déjà sans IA.
    try {
      const layerName = localize(layer.name, lang);
      let prompt: string;
      if (bbox) {
        // Une deuxième requête (toute la couche, sans bbox) sert uniquement de référence de
        // comparaison pour le prompt - jamais affichée telle quelle à l'utilisateur.
        const wholeLayerStats = await this.postGISService.getLayerStats(
          layer.schemaName,
          layer.tableName,
        );
        const buildPrompt = COMPARATIVE_PROMPT_BY_LANG[lang] ?? COMPARATIVE_PROMPT_BY_LANG['fr'];
        prompt = buildPrompt(layerName, stats, wholeLayerStats);
      } else {
        const buildPrompt = NARRATIVE_PROMPT_BY_LANG[lang] ?? NARRATIVE_PROMPT_BY_LANG['fr'];
        prompt = buildPrompt(layerName, stats);
      }
      const narrative = await this.geminiService.generateText(prompt);
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
