import { NominatimService, NominatimResult } from '../../../infrastructure/external-apis/nominatim.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('LookupGeocodingUseCase');

export class LookupGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(osmIds: string[]): Promise<NominatimResult[]> {
    logger.debug('Looking up OSM ids via Nominatim', { count: osmIds.length });
    return this.nominatimService.lookup(osmIds);
  }
}
