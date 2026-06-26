import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListBaseMapsUseCase } from '../../../../../src/application/use-cases/base-maps/list-base-maps.use-case.js';

describe('ListBaseMapsUseCase', () => {
  let useCase: ListBaseMapsUseCase;
  let repository: { findByInstance: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByInstance: vi.fn() };
    useCase = new ListBaseMapsUseCase(repository as any);
  });

  it('should return base maps for an instance', async () => {
    const maps = [{ id: '1' }, { id: '2' }];
    repository.findByInstance.mockResolvedValue(maps);

    const result = await useCase.execute('inst-1');
    expect(result).toEqual(maps);
    expect(repository.findByInstance).toHaveBeenCalledWith('inst-1');
  });

  it('should return empty array when none exist', async () => {
    repository.findByInstance.mockResolvedValue([]);
    const result = await useCase.execute('inst-1');
    expect(result).toEqual([]);
  });
});
