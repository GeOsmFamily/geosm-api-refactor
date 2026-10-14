import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListLayerSubGroupsUseCase } from '../../../../../src/application/use-cases/layer-sub-groups/list-layer-sub-groups.use-case.js';

describe('ListLayerSubGroupsUseCase', () => {
  let useCase: ListLayerSubGroupsUseCase;
  let repository: { findByLayerGroup: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByLayerGroup: vi.fn() };
    useCase = new ListLayerSubGroupsUseCase(repository as any);
  });

  it('should return sub-groups for a group', async () => {
    const sgs = [{ id: '1' }, { id: '2' }];
    repository.findByLayerGroup.mockResolvedValue(sgs);

    const result = await useCase.execute('g-1');
    expect(result).toEqual(sgs);
    expect(repository.findByLayerGroup).toHaveBeenCalledWith('g-1');
  });

  it('should return empty array when none exist', async () => {
    repository.findByLayerGroup.mockResolvedValue([]);
    const result = await useCase.execute('g-1');
    expect(result).toEqual([]);
  });
});
