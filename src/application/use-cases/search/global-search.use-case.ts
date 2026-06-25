import { MeiliSearchService } from '../../../infrastructure/external-apis/meilisearch.service.js';

export interface GlobalSearchResult {
  layers: Record<string, unknown>[];
  features: Record<string, unknown>[];
  query: string;
}

export class GlobalSearchUseCase {
  constructor(private readonly meiliSearchService: MeiliSearchService) {}

  async execute(query: string, limit?: number): Promise<GlobalSearchResult> {
    const [layersResult, featuresResult] = await Promise.all([
      this.meiliSearchService.search('layers', query, { limit }),
      this.meiliSearchService.search('features', query, { limit }),
    ]);
    return {
      layers: layersResult.hits,
      features: featuresResult.hits,
      query,
    };
  }
}
