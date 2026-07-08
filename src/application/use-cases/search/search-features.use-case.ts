import {
  MeiliSearchService,
  MeiliSearchResult,
} from '../../../infrastructure/external-apis/meilisearch.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchFeaturesUseCase');

export class SearchFeaturesUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(
    query: string,
    options?: { layerId?: string; limit?: number; offset?: number },
  ): Promise<MeiliSearchResult> {
    logger.debug('Searching features', { query, layerId: options?.layerId });
    const filter = options?.layerId ? `layerId = "${options.layerId}"` : undefined;
    return this.meiliSearchService.search('features', query, {
      filter,
      limit: options?.limit,
      offset: options?.offset,
    });
  }
}
