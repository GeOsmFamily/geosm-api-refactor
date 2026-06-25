import { MeiliSearchService, MeiliSearchResult } from '../../../infrastructure/external-apis/meilisearch.service.js';

export class SearchFeaturesUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(query: string, options?: { layerId?: string; limit?: number; offset?: number }): Promise<MeiliSearchResult> {
    const filter = options?.layerId ? `layerId = "${options.layerId}"` : undefined;
    return this.meiliSearchService.search('features', query, {
      filter,
      limit: options?.limit,
      offset: options?.offset,
    });
  }
}
