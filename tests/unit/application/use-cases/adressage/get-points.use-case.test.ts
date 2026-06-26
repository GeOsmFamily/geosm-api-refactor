import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPointsUseCase } from '../../../../../src/application/use-cases/adressage/get-points.use-case.js';

describe('GetPointsUseCase', () => {
  let useCase: GetPointsUseCase;
  let adressageService: { getPoints: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { getPoints: vi.fn() };
    useCase = new GetPointsUseCase(adressageService as any);
  });

  it('should return points data', async () => {
    const data = [{ lat: 3.8, lon: 11.5 }];
    adressageService.getPoints.mockResolvedValue(data);

    const result = await useCase.execute([3.8, 11.5], 'Rue Principale');
    expect(result).toEqual(data);
    expect(adressageService.getPoints).toHaveBeenCalledWith([3.8, 11.5], 'Rue Principale');
  });

  it('should propagate service errors', async () => {
    adressageService.getPoints.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute([0, 0], 'test')).rejects.toThrow('DB error');
  });
});
