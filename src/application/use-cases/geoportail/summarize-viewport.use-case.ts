import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import type { GeminiService } from '../../../infrastructure/external-apis/gemini.service.js';
import { logger } from '../../../infrastructure/observability/logger.js';
import { localize } from '../../utils/localize.js';

export interface LayerSummaryEntry {
  layerId: string;
  name: string;
  kind: 'vector' | 'raster';
  featureCount?: number;
  totalAreaKm2?: number | null;
  totalLengthKm?: number | null;
  raster?: { min: number | null; max: number | null; mean: number | null; sum: number | null; count: number };
}

export interface ViewportSummary {
  layerCount: number;
  totalFeatureCount: number;
  perLayer: LayerSummaryEntry[];
  narrative?: string;
}

/** Convertit une bbox [minLon,minLat,maxLon,maxLat] en polygone GeoJSON - sert de "zone" unique
 * pour les statistiques raster restreintes à l'emprise (voir getZonalStats), même principe que
 * la zone dessinée à la main (Lot "refonte Statistiques") mais générée depuis la vue carte. */
function bboxToPolygon(bbox: [number, number, number, number]): Record<string, unknown> {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  };
}

/** Réutilisé par analysis-report.worker.ts pour construire le prompt du rapport IA en PDF -
 * une seule façon de décrire une couche à Gemini, sur les deux fonctionnalités. */
export function formatLayerForPrompt(l: LayerSummaryEntry): string {
  if (l.kind === 'raster' && l.raster) {
    const parts = [`min ${l.raster.min ?? 'n/d'}`, `max ${l.raster.max ?? 'n/d'}`, `moyenne ${l.raster.mean?.toFixed(1) ?? 'n/d'}`];
    if (l.raster.sum != null) parts.push(`somme ${l.raster.sum.toFixed(0)}`);
    return `${l.name} [raster: ${parts.join(', ')}]`;
  }
  const extras: string[] = [];
  if (l.totalAreaKm2 != null) extras.push(`${l.totalAreaKm2.toFixed(2)} km²`);
  if (l.totalLengthKm != null) extras.push(`${l.totalLengthKm.toFixed(2)} km`);
  return `${l.name} (${l.featureCount} entités${extras.length ? ', ' + extras.join(', ') : ''})`;
}

const NARRATIVE_PROMPT_BY_LANG: Record<string, (layerList: string) => string> = {
  fr: (layerList) =>
    `Tu analyses plusieurs couches d'un géoportail actives simultanément sur la même zone (celle ` +
    `actuellement affichée à l'écran) : ${layerList}. Certaines couches sont vectorielles (nombre ` +
    `d'entités), d'autres sont des rasters (min/max/moyenne/somme des valeurs, ex: une couche de ` +
    `population donne une estimation d'habitants). Rédige en français un court paragraphe (3-4 ` +
    `phrases) qui CROISE ces couches entre elles pour produire une vraie déduction plutôt que ` +
    `de les décrire une par une - ex: rapporter le nombre d'écoles/hôpitaux à la population ` +
    `estimée (habitants par établissement), signaler une couverture qui semble faible ou forte ` +
    `au vu de ce ratio. Reste factuel : si une comparaison n'est pas calculable avec les chiffres ` +
    `donnés, ne l'invente pas.`,
  en: (layerList) =>
    `You are analyzing several geoportal layers simultaneously active on the same area (the one ` +
    `currently shown on screen): ${layerList}. Some layers are vector (feature count), others are ` +
    `rasters (min/max/mean/sum of values, e.g. a population layer gives an estimated inhabitant ` +
    `count). Write a short paragraph in English (3-4 sentences) that CROSSES these layers against ` +
    `each other to produce a real deduction rather than describing them one by one - e.g. relate ` +
    `the number of schools/hospitals to the estimated population (inhabitants per facility), flag ` +
    `coverage that looks weak or strong given that ratio. Stay factual: don't invent a comparison ` +
    `that isn't computable from the numbers given.`,
};

/**
 * Résumé/analyse croisée de la vue courante : agrège les statistiques de toutes les couches
 * actuellement actives sur la carte (vectorielles ET raster, restreintes à l'emprise visible si
 * fournie - voir PostGISService.getLayerStats/getZonalStats, tous deux extent-aware depuis le
 * lot "refonte Statistiques" du 2026-08-05), puis les transforme en une synthèse qui les CROISE
 * via Gemini plutôt que de les lister. Sert à la fois le bouton "résumé de la vue" du panneau
 * Couches actives (sans extent, historique) et l'outil `analyze_map_context` de l'assistant IA
 * (avec extent, nouveau).
 */
export class SummarizeViewportUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(
    layerIds: string[],
    lang = 'fr',
    extent?: [number, number, number, number],
  ): Promise<ViewportSummary> {
    const perLayer: LayerSummaryEntry[] = [];

    for (const layerId of layerIds) {
      try {
        const entry = await this.resolveLayerSummary(layerId, lang, extent);
        if (entry) perLayer.push(entry);
      } catch (error) {
        logger.warn('Statistiques indisponibles pour une couche du résumé de vue', {
          layerId,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    const totalFeatureCount = perLayer.reduce((sum, l) => sum + (l.featureCount ?? 0), 0);
    const summary: ViewportSummary = { layerCount: perLayer.length, totalFeatureCount, perLayer };

    if (perLayer.length === 0) return summary;

    try {
      const layerList = perLayer.map(formatLayerForPrompt).join('; ');
      const buildPrompt = NARRATIVE_PROMPT_BY_LANG[lang] ?? NARRATIVE_PROMPT_BY_LANG['fr'];
      const narrative = await this.geminiService.generateText(buildPrompt(layerList));
      summary.narrative = narrative;
    } catch (error) {
      logger.warn('Synthèse narrative de la vue courante indisponible (Gemini)', {
        error: error instanceof Error ? error.message : error,
      });
    }

    return summary;
  }

  private async resolveLayerSummary(
    layerId: string,
    lang: string,
    extent?: [number, number, number, number],
  ): Promise<LayerSummaryEntry | null> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer?.schemaName || !layer.tableName) return null;
    const name = localize(layer.name, lang);

    if (layer.metadata?.['source'] !== 'raster') {
      const stats = await this.postGISService.getLayerStats(layer.schemaName, layer.tableName, extent);
      return {
        layerId,
        name,
        kind: 'vector',
        featureCount: stats.featureCount,
        totalAreaKm2: stats.totalArea,
        totalLengthKm: stats.totalLength,
      };
    }

    if (!extent) {
      const stats = await this.postGISService.getRasterStats(layer.schemaName, layer.tableName);
      return { layerId, name, kind: 'raster', raster: { ...stats, sum: null } };
    }

    const [zone] = await this.postGISService.getZonalStats(layer.schemaName, layer.tableName, [
      { id: 0, name: 'extent', geojson: JSON.stringify(bboxToPolygon(extent)) },
    ]);
    return {
      layerId,
      name,
      kind: 'raster',
      raster: {
        min: zone?.min ?? null,
        max: zone?.max ?? null,
        mean: zone?.mean ?? null,
        sum: zone?.sum ?? null,
        count: zone?.count ?? 0,
      },
    };
  }
}
