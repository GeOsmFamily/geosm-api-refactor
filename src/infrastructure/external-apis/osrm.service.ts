import { trace } from '@opentelemetry/api';
import { config } from '../../config/env.config.js';

const tracer = trace.getTracer('geosm-osrm');

export interface OSRMRouteResult {
  code: string;
  routes: Array<{
    geometry: unknown;
    legs: unknown[];
    distance: number;
    duration: number;
  }>;
  waypoints: Array<{ location: [number, number]; name: string }>;
}

export interface OSRMNearestResult {
  code: string;
  waypoints: Array<{ location: [number, number]; name: string; distance: number }>;
}

export interface OSRMTableResult {
  code: string;
  // distances[i][j] = distance en mètres entre sources[i] et destinations[j] (null si aucun
  // itinéraire trouvé, ex. point isolé du réseau routier connu d'OSRM).
  distances: (number | null)[][];
  durations: (number | null)[][];
}

// Profils applicatifs (déjà utilisés côté frontend, ex. routing-tool.component.ts) vers les
// variables d'env OSRM_URL_* dédiées à un conteneur mono-profil - voir env.config.ts.
const PROFILE_URL_ENV_KEY: Record<string, 'OSRM_URL_CAR' | 'OSRM_URL_BICYCLE' | 'OSRM_URL_FOOT'> =
  {
    driving: 'OSRM_URL_CAR',
    cycling: 'OSRM_URL_BICYCLE',
    walking: 'OSRM_URL_FOOT',
  };

export class OSRMService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.OSRM_URL;
  }

  /** Résout l'URL du conteneur OSRM dédié à ce profil si configurée (déploiement prod
   * multi-profils), sinon retombe sur OSRM_URL (déploiement mono-profil, dev contre le
   * serveur de démo public qui gère déjà les 3 profils lui-même). */
  private resolveBaseUrl(profile: string): string {
    const envKey = PROFILE_URL_ENV_KEY[profile];
    return (envKey && config[envKey]) || this.baseUrl;
  }

  // Span manuel commun aux 3 appels OSRM - l'auto-instrumentation OTel existante ne couvre que
  // HTTP/DNS/ioredis, jamais les appels sortants applicatifs comme celui-ci.
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

  async route(
    coordinates: [number, number][],
    profile = 'driving',
    options?: { alternatives?: boolean; steps?: boolean; geometries?: string },
  ): Promise<OSRMRouteResult> {
    return this.traced('osrm.route', async () => {
      const coordStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');
      const params = new URLSearchParams();
      if (options?.alternatives) params.set('alternatives', 'true');
      if (options?.steps) params.set('steps', 'true');
      if (options?.geometries) params.set('geometries', options.geometries);
      const qs = params.toString() ? `?${params}` : '';
      const response = await fetch(
        `${this.resolveBaseUrl(profile)}/route/v1/${profile}/${coordStr}${qs}`,
      );
      if (!response.ok) throw new Error(`OSRM route failed: ${response.statusText}`);
      return response.json() as Promise<OSRMRouteResult>;
    });
  }

  async nearest(lon: number, lat: number, number = 1): Promise<OSRMNearestResult> {
    return this.traced('osrm.nearest', async () => {
      const response = await fetch(
        `${this.resolveBaseUrl('driving')}/nearest/v1/driving/${lon},${lat}?number=${number}`,
      );
      if (!response.ok) throw new Error(`OSRM nearest failed: ${response.statusText}`);
      return response.json() as Promise<OSRMNearestResult>;
    });
  }

  // Matrice de distances/durées un-vers-plusieurs en un seul appel HTTP (plutôt que N appels
  // à route() pour N candidats) - utilisé par FindNearestFeatureUseCase pour classer des
  // candidats par distance ROUTIÈRE réelle.
  async table(
    coordinates: [number, number][],
    sources: number[],
    destinations: number[],
    profile = 'driving',
  ): Promise<OSRMTableResult> {
    return this.traced('osrm.table', async () => {
      const coordStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(';');
      const params = new URLSearchParams();
      params.set('sources', sources.join(';'));
      params.set('destinations', destinations.join(';'));
      params.set('annotations', 'distance,duration');
      const response = await fetch(
        `${this.resolveBaseUrl(profile)}/table/v1/${profile}/${coordStr}?${params}`,
      );
      if (!response.ok) throw new Error(`OSRM table failed: ${response.statusText}`);
      return response.json() as Promise<OSRMTableResult>;
    });
  }
}
