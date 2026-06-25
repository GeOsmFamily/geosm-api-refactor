import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListLayersUseCase } from '../../../../../src/application/use-cases/layers/list-layers.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';

describe('ListLayersUseCase', () => {
  let useCase: ListLayersUseCase;
  let layerRepository: ILayerRepository;

  beforeEach(() => {
    layerRepository = { findById: vi.fn(), findBySlug: vi.fn(), findBySubGroup: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new ListLayersUseCase(layerRepository);
  });

  it('should return paginated layers', async () => {
    vi.mocked(layerRepository.findByInstance).mockResolvedValue({ data: [], total: 0 });
    const result = await useCase.execute('i1', { page: 2, limit: 5 });
    expect(result).toEqual({ data: [], total: 0 });
  });

  it('should use default pagination', async () => {
    vi.mocked(layerRepository.findByInstance).mockResolvedValue({ data: [], total: 0 });
    await useCase.execute('i1', {});
    expect(layerRepository.findByInstance).toHaveBeenCalledWith('i1', expect.objectContaining({ page: 1, limit: 20 }));
  });
});
