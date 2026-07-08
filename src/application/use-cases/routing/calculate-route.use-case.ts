import { OSRMService } from '../../../infrastructure/external-apis/osrm.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CalculateRouteUseCase');

export class CalculateRouteUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(
    coordinates: [number, number][],
    profile?: string,
    options?: { alternatives?: boolean; steps?: boolean; geometries?: string },
  ): Promise<Record<string, unknown>> {
    const result = await this.osrmService.route(coordinates, profile, options);
    if (!result.routes || result.routes.length === 0) {
      logger.warn('OSRM route calculation returned no routes', {
        profile,
        waypointCount: coordinates.length,
      });
      throw new Error('No route found');
    }
    const route = result.routes[0];
    logger.info('Route calculated', {
      profile,
      distance: route.distance,
      duration: route.duration,
    });
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: route.geometry,
      legs: route.legs,
      waypoints: result.waypoints,
    };
  }
}
