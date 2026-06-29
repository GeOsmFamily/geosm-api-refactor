import { OSRMService } from '../../../infrastructure/external-apis/osrm.service.js';

export class CalculateRouteUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(coordinates: [number, number][], profile?: string, options?: { alternatives?: boolean; steps?: boolean; geometries?: string }): Promise<Record<string, unknown>> {
    const result = await this.osrmService.route(coordinates, profile, options);
    if (!result.routes || result.routes.length === 0) {
      throw new Error('No route found');
    }
    const route = result.routes[0];
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      legs: route.legs,
      waypoints: result.waypoints
    };
  }
}
