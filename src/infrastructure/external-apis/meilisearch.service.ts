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

  /**
   * Déclare les attributs filtrables d'un index (ex: "instanceId", "layerId") - sans ça,
   * toute recherche utilisant `filter` échoue en "Bad Request" (MeiliSearch exige une
   * déclaration explicite). Idempotent, à appeler avant/pendant l'indexation initiale d'un
   * index (voir ReindexAllLayersUseCase) : `addDocuments` seul crée l'index sans aucun
   * attribut filtrable configuré.
   */
  async updateFilterableAttributes(indexName: string, attributes: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/indexes/${indexName}/settings/filterable-attributes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify(attributes),
    });
    if (!response.ok) throw new Error(`MeiliSearch updateFilterableAttributes failed: ${response.statusText}`);
  }

  /**
   * `primaryKey` doit être fourni explicitement dès lors qu'un document a plus d'un champ se
   * terminant par "id" (ex: `id` + `instanceId` + `subGroupId` pour une couche) : sans ça,
   * l'inférence automatique de MeiliSearch échoue et la tâche d'indexation échoue de façon
   * silencieuse (l'appel HTTP répond quand même 202 "tâche acceptée" - l'échec ne se voit que
   * dans /tasks, jamais dans la réponse de cet appel).
   */
  async addDocuments(indexName: string, documents: Record<string, unknown>[], primaryKey?: string): Promise<void> {
    const qs = primaryKey ? `?primaryKey=${encodeURIComponent(primaryKey)}` : '';
    const response = await fetch(`${this.baseUrl}/indexes/${indexName}/documents${qs}`, {
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
