import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListMyPersonalLayersUseCase } from '../../../../../src/application/use-cases/personal-layers/list-my-personal-layers.use-case.js';

describe('ListMyPersonalLayersUseCase', () => {
  let useCase: ListMyPersonalLayersUseCase;
  let repository: { listForUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { listForUser: vi.fn() };
    useCase = new ListMyPersonalLayersUseCase(repository as any);
  });

  it("should return the caller's personal layers for the given instance", async () => {
    const layers = [{ id: 'pl-1' }, { id: 'pl-2' }];
    repository.listForUser.mockResolvedValue(layers);

    const result = await useCase.execute('user-1', 'instance-1');

    expect(repository.listForUser).toHaveBeenCalledWith('user-1', 'instance-1');
    expect(result).toBe(layers);
  });

  it('should return an empty array when the user has no personal layers', async () => {
    repository.listForUser.mockResolvedValue([]);

    const result = await useCase.execute('user-2', 'instance-1');

    expect(result).toEqual([]);
  });
});
