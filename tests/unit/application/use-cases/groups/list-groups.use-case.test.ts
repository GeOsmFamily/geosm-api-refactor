import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListGroupsUseCase } from '../../../../../src/application/use-cases/groups/list-groups.use-case.js';
import type { IGroupRepository } from '../../../../../src/domain/repositories/group.repository.js';

describe('ListGroupsUseCase', () => {
  let useCase: ListGroupsUseCase;
  let groupRepository: IGroupRepository;

  beforeEach(() => {
    groupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    useCase = new ListGroupsUseCase(groupRepository);
  });

  it('should return groups for instance', async () => {
    vi.mocked(groupRepository.findByInstance).mockResolvedValue([]);
    const result = await useCase.execute('inst-1');
    expect(result).toEqual([]);
    expect(groupRepository.findByInstance).toHaveBeenCalledWith('inst-1', undefined);
  });

  it('should pass includeSubGroups flag', async () => {
    vi.mocked(groupRepository.findByInstance).mockResolvedValue([]);
    await useCase.execute('inst-1', true);
    expect(groupRepository.findByInstance).toHaveBeenCalledWith('inst-1', true);
  });
});
