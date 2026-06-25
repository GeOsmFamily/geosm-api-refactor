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
}
