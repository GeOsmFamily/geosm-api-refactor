import { MeiliSearchService, MeiliSearchResult } from '../../../infrastructure/external-apis/meilisearch.service.js';

export class SearchLayersUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(query: string, options?: { instanceId?: string; limit?: number; offset?: number }): Promise<MeiliSearchResult> {
    const filter = options?.instanceId ? `instanceId = "${options.instanceId}"` : undefined;
    return this.meiliSearchService.search('layers', query, {
      filter,
      limit: options?.limit,
      offset: options?.offset,
    });
  }
}
