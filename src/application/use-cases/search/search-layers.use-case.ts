import {
  MeiliSearchService,
  MeiliSearchResult,
} from '../../../infrastructure/external-apis/meilisearch.service.js';

/** Remplace `name`/`description` par la variante `name_{lang}`/`description_{lang}` indexée
 * (voir IndexLayerUseCase) - repli sur `name`/`description` bruts si absents (documents
 * indexés avant ce champ). */
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchLayersUseCase');

function localizeHit(hit: Record<string, unknown>, lang: string): Record<string, unknown> {
  const localizedName = hit[`name_${lang}`] ?? hit['name_fr'] ?? hit['name'];
  const localizedDescription =
    hit[`description_${lang}`] ?? hit['description_fr'] ?? hit['description'];
  return { ...hit, name: localizedName, description: localizedDescription };
}

export class SearchLayersUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(
    query: string,
    options?: { instanceId?: string; limit?: number; offset?: number; lang?: string },
  ): Promise<MeiliSearchResult> {
    logger.debug('Searching layers', { query, instanceId: options?.instanceId });
    const filter = options?.instanceId ? `instanceId = "${options.instanceId}"` : undefined;
    const result = await this.meiliSearchService.search('layers', query, {
      filter,
      limit: options?.limit,
      offset: options?.offset,
    });
    const lang = options?.lang ?? 'fr';
    return { ...result, hits: result.hits.map((hit) => localizeHit(hit, lang)) };
  }
}
