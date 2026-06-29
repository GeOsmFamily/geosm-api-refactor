import { config } from '../../config/env.config.js';

export interface MeiliSearchResult {
  hits: Record<string, unknown>[];
  estimatedTotalHits: number;
  offset: number;
  limit: number;
  processingTimeMs: number;
  query: string;
}

export class MeiliSearchService {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = config.MEILISEARCH_HOST;
    this.apiKey = config.MEILISEARCH_API_KEY;
  }

  async search(indexName: string, query: string, options?: { filter?: string; limit?: number; offset?: number }): Promise<MeiliSearchResult> {
    const body: Record<string, unknown> = { q: query };
    if (options?.filter) body.filter = options.filter;
    if (options?.limit) body.limit = options.limit;
    if (options?.offset) body.offset = options.offset;
    const response = await fetch(`${this.baseUrl}/indexes/${indexName}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      if (response.status === 404) {
        return { hits: [], estimatedTotalHits: 0, offset: 0, limit: 10, processingTimeMs: 0, query };
      }
      throw new Error(`MeiliSearch search failed: ${response.statusText}`);
    }
    return response.json() as Promise<MeiliSearchResult>;
  }

  async addDocuments(indexName: string, documents: Record<string, unknown>[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/indexes/${indexName}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(documents),
    });
    if (!response.ok) throw new Error(`MeiliSearch addDocuments failed: ${response.statusText}`);
  }

  async deleteDocuments(indexName: string, ids: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/indexes/${indexName}/documents/delete-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(ids),
    });
    if (!response.ok) throw new Error(`MeiliSearch deleteDocuments failed: ${response.statusText}`);
  }
}
