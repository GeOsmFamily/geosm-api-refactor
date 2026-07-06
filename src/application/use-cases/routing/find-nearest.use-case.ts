import { OSRMService, OSRMNearestResult } from '../../../infrastructure/external-apis/osrm.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('FindNearestUseCase');

export class FindNearestUseCase {
  constructor(private readonly osrmService: OSRMService) {}

  async execute(lon: number, lat: number, number?: number): Promise<OSRMNearestResult> {
    logger.debug('Finding nearest OSRM point', { lon, lat });
    return this.osrmService.nearest(lon, lat, number);
  }
}
