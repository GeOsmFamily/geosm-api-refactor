import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReverseGeocodingUseCase } from '../../../../../src/application/use-cases/geocoding/reverse-geocoding.use-case.js';

describe('ReverseGeocodingUseCase', () => {
  let useCase: ReverseGeocodingUseCase;
  let nominatimService: { reverse: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    nominatimService = { reverse: vi.fn() };
    useCase = new ReverseGeocodingUseCase(nominatimService as any);
  });

  it('should reverse geocode coordinates', async () => {
    const mockResult = { display_name: '123 Main St', lat: '45.0', lon: '10.0' };
    nominatimService.reverse.mockResolvedValue(mockResult);
    const result = await useCase.execute(45.0, 10.0);
    expect(result).toEqual(mockResult);
    expect(nominatimService.reverse).toHaveBeenCalledWith(45.0, 10.0);
  });
});
