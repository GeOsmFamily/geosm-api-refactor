import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAdresseUseCase } from '../../../../../src/application/use-cases/adressage/get-adresse.use-case.js';

describe('GetAdresseUseCase', () => {
  let useCase: GetAdresseUseCase;
  let adressageService: { getAdresse: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { getAdresse: vi.fn() };
    useCase = new GetAdresseUseCase(adressageService as any);
  });

  it('should return address data', async () => {
    const data = { address: 'Rue 1' };
    adressageService.getAdresse.mockResolvedValue(data);

    const result = await useCase.execute('public', 'addresses', 'geom');
    expect(result).toEqual(data);
    expect(adressageService.getAdresse).toHaveBeenCalledWith('public', 'addresses', 'geom');
  });

  it('should propagate service errors', async () => {
    adressageService.getAdresse.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute('s', 't', 'g')).rejects.toThrow('DB error');
  });
});
