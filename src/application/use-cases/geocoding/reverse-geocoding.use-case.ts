import { NominatimService, NominatimResult } from '../../../infrastructure/external-apis/nominatim.service.js';

export class ReverseGeocodingUseCase {
  constructor(private readonly nominatimService: NominatimService) {}

  async execute(lat: number, lon: number): Promise<NominatimResult> {
    return this.nominatimService.reverse(lat, lon);
  }
}
