import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteGroupUseCase } from '../../../../../src/application/use-cases/groups/delete-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IGroupRepository } from '../../../../../src/domain/repositories/group.repository.js';
import { Group } from '../../../../../src/domain/entities/group.entity.js';

describe('DeleteGroupUseCase', () => {
  let useCase: DeleteGroupUseCase;
  let groupRepository: IGroupRepository;
  const now = new Date();
  const mockGroup = new Group({
    id: 'g1', name: 'Group', slug: 'group', description: null, icon: null,
    color: null, order: 0, isActive: true, instanceId: 'i1', createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    groupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    useCase = new DeleteGroupUseCase(groupRepository);
  });

  it('should delete group when found', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(mockGroup);
    await useCase.execute('g1');
    expect(groupRepository.delete).toHaveBeenCalledWith('g1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('g1')).rejects.toThrow(NotFoundError);
  });
});
