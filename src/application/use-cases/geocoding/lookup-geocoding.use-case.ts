import { NominatimService, NominatimResult } from '../../../infrastructure/external-apis/nominatim.service.js';

export class LookupGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(osmIds: string[]): Promise<NominatimResult[]> {
    return this.nominatimService.lookup(osmIds);
  }
}
