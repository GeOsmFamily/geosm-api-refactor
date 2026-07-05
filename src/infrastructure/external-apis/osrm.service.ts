import { config } from '../../config/env.config.js';

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

export class OSRMService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.OSRM_URL;
  }

  async route(coordinates: [number, number][], profile = 'driving', options?: { alternatives?: boolean; steps?: boolean; geometries?: string }): Promise<OSRMRouteResult> {
    const coordStr = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const params = new URLSearchParams();
    if (options?.alternatives) params.set('alternatives', 'true');
    if (options?.steps) params.set('steps', 'true');
    if (options?.geometries) params.set('geometries', options.geometries);
    const qs = params.toString() ? `?${params}` : '';
    const response = await fetch(`${this.baseUrl}/route/v1/${profile}/${coordStr}${qs}`);
    if (!response.ok) throw new Error(`OSRM route failed: ${response.statusText}`);
    return response.json() as Promise<OSRMRouteResult>;
  }

  async nearest(lon: number, lat: number, number = 1): Promise<OSRMNearestResult> {
    const response = await fetch(`${this.baseUrl}/nearest/v1/driving/${lon},${lat}?number=${number}`);
    if (!response.ok) throw new Error(`OSRM nearest failed: ${response.statusText}`);
    return response.json() as Promise<OSRMNearestResult>;
  }

  // Matrice de distances/durées un-vers-plusieurs en un seul appel HTTP (plutôt que N appels
  // à route() pour N candidats) - utilisé par FindNearestFeatureUseCase pour classer des
  // candidats par distance ROUTIÈRE réelle.
  async table(coordinates: [number, number][], sources: number[], destinations: number[], profile = 'driving'): Promise<OSRMTableResult> {
    const coordStr = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const params = new URLSearchParams();
    params.set('sources', sources.join(';'));
    params.set('destinations', destinations.join(';'));
    params.set('annotations', 'distance,duration');
    const response = await fetch(`${this.baseUrl}/table/v1/${profile}/${coordStr}?${params}`);
    if (!response.ok) throw new Error(`OSRM table failed: ${response.statusText}`);
    return response.json() as Promise<OSRMTableResult>;
  }
}
