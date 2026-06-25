import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchGeocodingUseCase } from '../../../../../src/application/use-cases/geocoding/search-geocoding.use-case.js';
import type { NominatimService, NominatimResult } from '../../../../../src/infrastructure/external-apis/nominatim.service.js';

describe('SearchGeocodingUseCase', () => {
  let useCase: SearchGeocodingUseCase;
  let nominatimService: NominatimService;

  beforeEach(() => {
    nominatimService = {
      search: vi.fn(),
      reverse: vi.fn(),
      lookup: vi.fn(),
    } as unknown as NominatimService;
    useCase = new SearchGeocodingUseCase(nominatimService);
  });

  it('should search for locations', async () => {
    const mockResults: NominatimResult[] = [
      {
        place_id: 1,
        licence: 'test',
        osm_type: 'node',
        osm_id: 123,
        lat: '48.8566',
        lon: '2.3522',
        display_name: 'Paris, France',
        boundingbox: ['48.8', '48.9', '2.3', '2.4'],
        type: 'city',
        importance: 0.9,
      },
    ];
    vi.mocked(nominatimService.search).mockResolvedValue(mockResults);

    const result = await useCase.execute('Paris');

    expect(result).toEqual(mockResults);
    expect(nominatimService.search).toHaveBeenCalledWith('Paris', undefined);
  });

  it('should pass search options', async () => {
    vi.mocked(nominatimService.search).mockResolvedValue([]);

    await useCase.execute('test', { limit: 5, countrycodes: 'fr' });

    expect(nominatimService.search).toHaveBeenCalledWith('test', { limit: 5, countrycodes: 'fr' });
  });
});
