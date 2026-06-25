import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteSubGroupUseCase } from '../../../../../src/application/use-cases/sub-groups/delete-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { ISubGroupRepository } from '../../../../../src/domain/repositories/sub-group.repository.js';
import { SubGroup } from '../../../../../src/domain/entities/sub-group.entity.js';

describe('DeleteSubGroupUseCase', () => {
  let useCase: DeleteSubGroupUseCase;
  let subGroupRepository: ISubGroupRepository;
  const now = new Date();
  const mockSubGroup = new SubGroup({ id: 'sg1', name: 'Sub', slug: 'sub', description: null, icon: null, order: 0, isActive: true, groupId: 'g1', createdAt: now, updatedAt: now });

  beforeEach(() => {
    subGroupRepository = { findById: vi.fn(), findBySlug: vi.fn(), findByGroup: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new DeleteSubGroupUseCase(subGroupRepository);
  });

  it('should delete sub-group when found', async () => {
    vi.mocked(subGroupRepository.findById).mockResolvedValue(mockSubGroup);
    await useCase.execute('sg1');
    expect(subGroupRepository.delete).toHaveBeenCalledWith('sg1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(subGroupRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('sg1')).rejects.toThrow(NotFoundError);
  });
});
