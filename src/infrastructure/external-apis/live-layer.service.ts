import { trace } from '@opentelemetry/api';
import type { RedisService } from '../cache/redis.service.js';
import { logger } from '../observability/logger.js';

const tracer = trace.getTracer('geosm-live-layer');
const FETCH_TIMEOUT_MS = 8000;
const CACHE_PREFIX = 'live-layer:';

export interface LiveLayerConfig {
  url: string;
  // Durée de mise en cache Redis en secondes - au-delà, l'appel externe est refait. Distinct de
  // refreshSeconds (fréquence de polling frontend) : plusieurs visiteurs de la même instance
  // partagent le même cache, donc ttlSeconds peut être plus court que refreshSeconds sans
  // multiplier les appels externes au-delà d'une fois par ttlSeconds au total.
  ttlSeconds: number;
  refreshSeconds: number;
}

export interface LiveLayerResult {
  data: unknown;
  cachedAt: string;
  fromCache: boolean;
}

/** Cache-aside générique pour une source de données externe (capteurs temps réel, ex. qualité de
 * l'air, météo) configurée par couche via `Layer.metadata.live` - voir plan "Couches vivantes +
 * rapport de fraîcheur" du 2026-08-06. Premier usage de RedisService en cache-aside dans ce
 * code (jusqu'ici seulement utilisé pour des ping() de santé) - Nominatim/Gemini ne sont
 * toujours pas cachés, ce service ne concerne QUE les couches vivantes. */
export class LiveLayerService {
  constructor(private readonly redisService: RedisService) {}

  async fetch(layerId: string, config: LiveLayerConfig): Promise<LiveLayerResult> {
    const cacheKey = `${CACHE_PREFIX}${layerId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { data: unknown; cachedAt: string };
      return { ...parsed, fromCache: true };
    }

    const data = await this.fetchExternal(config.url);
    const cachedAt = new Date().toISOString();
    await this.redisService.set(cacheKey, JSON.stringify({ data, cachedAt }), config.ttlSeconds);
    return { data, cachedAt, fromCache: false };
  }

  private async fetchExternal(url: string): Promise<unknown> {
    return tracer.startActiveSpan('live-layer.fetch', async (span) => {
      // Aucun appel externe de ce code n'a de timeout aujourd'hui (Nominatim/Gemini inclus) -
      // une couche vivante mal configurée (URL lente/indisponible) ne doit pas pouvoir bloquer
      // une requête HTTP entrante indéfiniment, d'où cet AbortController.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Couche vivante indisponible : ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        logger.warn('Échec de récupération de couche vivante', {
          url,
          error: error instanceof Error ? error.message : error,
        });
        throw error;
      } finally {
        clearTimeout(timer);
        span.end();
      }
    });
  }
}
