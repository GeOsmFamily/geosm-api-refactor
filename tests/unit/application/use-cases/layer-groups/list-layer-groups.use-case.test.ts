import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListLayerGroupsUseCase } from '../../../../../src/application/use-cases/layer-groups/list-layer-groups.use-case.js';
import type { ILayerGroupRepository } from '../../../../../src/domain/repositories/layer-group.repository.js';

describe('ListLayerGroupsUseCase', () => {
  let useCase: ListLayerGroupsUseCase;
  let layerGroupRepository: ILayerGroupRepository;

  beforeEach(() => {
    layerGroupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    useCase = new ListLayerGroupsUseCase(layerGroupRepository);
  });

  it('should return groups for instance', async () => {
    vi.mocked(layerGroupRepository.findByInstance).mockResolvedValue([]);
    const result = await useCase.execute('inst-1');
    expect(result).toEqual([]);
    expect(layerGroupRepository.findByInstance).toHaveBeenCalledWith('inst-1', undefined);
  });

  it('should pass includeSubGroups flag', async () => {
    vi.mocked(layerGroupRepository.findByInstance).mockResolvedValue([]);
    await useCase.execute('inst-1', true);
    expect(layerGroupRepository.findByInstance).toHaveBeenCalledWith('inst-1', true);
  });
});
