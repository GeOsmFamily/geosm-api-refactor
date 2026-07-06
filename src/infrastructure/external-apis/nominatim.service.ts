import { trace } from '@opentelemetry/api';
import { config } from '../../config/env.config.js';

const tracer = trace.getTracer('geosm-nominatim');

export interface NominatimResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: string[];
  class: string;
  type: string;
  importance: number;
  geojson?: unknown;
}

export class NominatimService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.NOMINATIM_URL;
  }

  private async traced<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
    return tracer.startActiveSpan(spanName, async (span) => {
      try {
        return await fn();
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async search(query: string, options?: { viewbox?: string; bounded?: boolean; limit?: number; countrycodes?: string }): Promise<NominatimResult[]> {
    return this.traced('nominatim.search', async () => {
      const params = new URLSearchParams({ q: query, format: 'json', polygon_geojson: '1' });
      if (options?.viewbox) params.set('viewbox', options.viewbox);
      if (options?.bounded) params.set('bounded', '1');
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.countrycodes) params.set('countrycodes', options.countrycodes);
      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: { 'User-Agent': 'GeOSM-API/1.0' },
      });
      if (!response.ok) throw new Error(`Nominatim search failed: ${response.statusText}`);
      return response.json() as Promise<NominatimResult[]>;
    });
  }

  async reverse(lat: number, lon: number): Promise<NominatimResult> {
    return this.traced('nominatim.reverse', async () => {
      const params = new URLSearchParams({ lat: String(lat), lon: String(lon), format: 'json' });
      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: { 'User-Agent': 'GeOSM-API/1.0' },
      });
      if (!response.ok) throw new Error(`Nominatim reverse failed: ${response.statusText}`);
      return response.json() as Promise<NominatimResult>;
    });
  }

  async lookup(osmIds: string[]): Promise<NominatimResult[]> {
    return this.traced('nominatim.lookup', async () => {
      const params = new URLSearchParams({ osm_ids: osmIds.join(','), format: 'json', polygon_geojson: '1' });
      const response = await fetch(`${this.baseUrl}/lookup?${params}`, {
        headers: { 'User-Agent': 'GeOSM-API/1.0' },
      });
      if (!response.ok) throw new Error(`Nominatim lookup failed: ${response.statusText}`);
      return response.json() as Promise<NominatimResult[]>;
    });
  }
}
