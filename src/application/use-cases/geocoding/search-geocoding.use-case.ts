import {
  NominatimService,
  NominatimResult,
} from '../../../infrastructure/external-apis/nominatim.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchGeocodingUseCase');

export class SearchGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(
    query: string,
    options?: { viewbox?: string; bounded?: boolean; limit?: number; countrycodes?: string },
  ): Promise<NominatimResult[]> {
    logger.debug('Searching address via Nominatim', { query });
    return this.nominatimService.search(query, options);
  }
}
