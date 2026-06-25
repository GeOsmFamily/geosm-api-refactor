import { OSRMService, OSRMNearestResult } from '../../../infrastructure/external-apis/osrm.service.js';

export class FindNearestUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(lon: number, lat: number, number?: number): Promise<OSRMNearestResult> {
    return this.osrmService.nearest(lon, lat, number);
  }
}
