import { NominatimService, NominatimResult } from '../../../infrastructure/external-apis/nominatim.service.js';

export class SearchGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(query: string, options?: { viewbox?: string; bounded?: boolean; limit?: number; countrycodes?: string }): Promise<NominatimResult[]> {
    return this.nominatimService.search(query, options);
  }
}
