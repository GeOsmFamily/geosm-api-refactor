import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchAdresseUseCase } from '../../../../../src/application/use-cases/adressage/search-adresse.use-case.js';

describe('SearchAdresseUseCase', () => {
  let useCase: SearchAdresseUseCase;
  let adressageService: { searchAdresse: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { searchAdresse: vi.fn() };
    useCase = new SearchAdresseUseCase(adressageService as any);
  });

  it('should return search results', async () => {
    const results = [{ id: '1', name: 'Rue 1' }];
    adressageService.searchAdresse.mockResolvedValue(results);

    const result = await useCase.execute('commerce');
    expect(result).toEqual(results);
    expect(adressageService.searchAdresse).toHaveBeenCalledWith('commerce');
  });

  it('should propagate service errors', async () => {
    adressageService.searchAdresse.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute('test')).rejects.toThrow('DB error');
  });
});
