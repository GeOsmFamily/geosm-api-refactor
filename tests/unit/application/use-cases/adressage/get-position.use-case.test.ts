import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPositionUseCase } from '../../../../../src/application/use-cases/adressage/get-position.use-case.js';

describe('GetPositionUseCase', () => {
  let useCase: GetPositionUseCase;
  let adressageService: { getPosition: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { getPosition: vi.fn() };
    useCase = new GetPositionUseCase(adressageService as any);
  });

  it('should return position for address', async () => {
    const data = { lat: 3.8, lon: 11.5 };
    adressageService.getPosition.mockResolvedValue(data);

    const result = await useCase.execute('Rue Principale, Yaoundé');
    expect(result).toEqual(data);
    expect(adressageService.getPosition).toHaveBeenCalledWith('Rue Principale, Yaoundé');
  });

  it('should propagate service errors', async () => {
    adressageService.getPosition.mockRejectedValue(new Error('Not found'));
    await expect(useCase.execute('unknown')).rejects.toThrow('Not found');
  });
});
