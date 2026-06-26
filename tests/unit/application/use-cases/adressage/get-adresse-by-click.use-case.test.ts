import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetAdresseByClickUseCase } from '../../../../../src/application/use-cases/adressage/get-adresse-by-click.use-case.js';

describe('GetAdresseByClickUseCase', () => {
  let useCase: GetAdresseByClickUseCase;
  let adressageService: { getAdresseByClick: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { getAdresseByClick: vi.fn() };
    useCase = new GetAdresseByClickUseCase(adressageService as any);
  });

  it('should return address for coordinates', async () => {
    const address = { id: '1', rue: 'Rue Principale' };
    adressageService.getAdresseByClick.mockResolvedValue(address);

    const result = await useCase.execute([3.8, 11.5]);
    expect(result).toEqual(address);
    expect(adressageService.getAdresseByClick).toHaveBeenCalledWith([3.8, 11.5]);
  });

  it('should propagate service errors', async () => {
    adressageService.getAdresseByClick.mockRejectedValue(new Error('Not found'));
    await expect(useCase.execute([0, 0])).rejects.toThrow('Not found');
  });
});
