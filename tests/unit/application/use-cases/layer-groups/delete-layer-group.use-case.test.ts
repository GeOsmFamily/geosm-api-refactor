import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteLayerGroupUseCase } from '../../../../../src/application/use-cases/layer-groups/delete-layer-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { ILayerGroupRepository } from '../../../../../src/domain/repositories/layer-group.repository.js';
import { LayerGroup } from '../../../../../src/domain/entities/layer-group.entity.js';

describe('DeleteLayerGroupUseCase', () => {
  let useCase: DeleteLayerGroupUseCase;
  let layerGroupRepository: ILayerGroupRepository;
  const now = new Date();
  const mockLayerGroup = new LayerGroup({
    id: 'g1', name: 'LayerGroup', slug: 'group', description: null, icon: null,
    color: null, order: 0, isActive: true, instanceId: 'i1', createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    layerGroupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    useCase = new DeleteLayerGroupUseCase(layerGroupRepository);
  });

  it('should delete group when found', async () => {
    vi.mocked(layerGroupRepository.findById).mockResolvedValue(mockLayerGroup);
    await useCase.execute('g1');
    expect(layerGroupRepository.delete).toHaveBeenCalledWith('g1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(layerGroupRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('g1')).rejects.toThrow(NotFoundError);
  });
});
