import {
  NominatimService,
  NominatimResult,
} from '../../../infrastructure/external-apis/nominatim.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ReverseGeocodingUseCase');

export class ReverseGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(lat: number, lon: number): Promise<NominatimResult> {
    logger.debug('Reverse geocoding via Nominatim', { lat, lon });
    return this.nominatimService.reverse(lat, lon);
  }
}
