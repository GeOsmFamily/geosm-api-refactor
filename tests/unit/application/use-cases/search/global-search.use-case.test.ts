import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GlobalSearchUseCase } from '../../../../../src/application/use-cases/search/global-search.use-case.js';

describe('GlobalSearchUseCase', () => {
  let useCase: GlobalSearchUseCase;
  let meiliSearchService: { search: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    meiliSearchService = { search: vi.fn() };
    useCase = new GlobalSearchUseCase(meiliSearchService as any);
  });

  it('should search across layers and features', async () => {
    meiliSearchService.search
      .mockResolvedValueOnce({ hits: [{ id: 'l1', name: 'Rivers' }] })
      .mockResolvedValueOnce({ hits: [{ id: 'f1', name: 'River Nile' }] });
    const result = await useCase.execute('river');
    expect(result.query).toBe('river');
    expect(result.layers).toHaveLength(1);
    expect(result.features).toHaveLength(1);
  });

  it('should return empty results', async () => {
    meiliSearchService.search.mockResolvedValue({ hits: [] });
    const result = await useCase.execute('nonexistent');
    expect(result.layers).toEqual([]);
    expect(result.features).toEqual([]);
  });
});
