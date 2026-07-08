import { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GlobalSearchUseCase');

export interface GlobalSearchResult {
  layers: Record<string, unknown>[];
  features: Record<string, unknown>[];
  query: string;
}

/** Voir SearchLayersUseCase.localizeHit - même repli name_{lang} -> name_fr -> name brut. */
function localizeHit(hit: Record<string, unknown>, lang: string): Record<string, unknown> {
  const localizedName = hit[`name_${lang}`] ?? hit['name_fr'] ?? hit['name'];
  const localizedDescription =
    hit[`description_${lang}`] ?? hit['description_fr'] ?? hit['description'];
  return { ...hit, name: localizedName, description: localizedDescription };
}

export class GlobalSearchUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(query: string, limit?: number, lang = 'fr'): Promise<GlobalSearchResult> {
    logger.debug('Global search executed', { query });
    const [layersResult, featuresResult] = await Promise.all([
      this.meiliSearchService.search('layers', query, { limit }),
      this.meiliSearchService.search('features', query, { limit }),
    ]);
    return {
      layers: layersResult.hits.map((hit) => localizeHit(hit, lang)),
      features: featuresResult.hits,
      query,
    };
  }
}
