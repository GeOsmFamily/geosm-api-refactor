import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListSubGroupsUseCase } from '../../../../../src/application/use-cases/sub-groups/list-sub-groups.use-case.js';

describe('ListSubGroupsUseCase', () => {
  let useCase: ListSubGroupsUseCase;
  let repository: { findByGroup: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByGroup: vi.fn() };
    useCase = new ListSubGroupsUseCase(repository as any);
  });

  it('should return sub-groups for a group', async () => {
    const sgs = [{ id: '1' }, { id: '2' }];
    repository.findByGroup.mockResolvedValue(sgs);

    const result = await useCase.execute('g-1');
    expect(result).toEqual(sgs);
    expect(repository.findByGroup).toHaveBeenCalledWith('g-1');
  });

  it('should return empty array when none exist', async () => {
    repository.findByGroup.mockResolvedValue([]);
    const result = await useCase.execute('g-1');
    expect(result).toEqual([]);
  });
});
