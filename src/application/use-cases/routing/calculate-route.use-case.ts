import { OSRMService, OSRMRouteResult } from '../../../infrastructure/external-apis/osrm.service.js';

export class CalculateRouteUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(coordinates: [number, number][], profile?: string, options?: { alternatives?: boolean; steps?: boolean; geometries?: string }): Promise<OSRMRouteResult> {
    return this.osrmService.route(coordinates, profile, options);
  }
}
