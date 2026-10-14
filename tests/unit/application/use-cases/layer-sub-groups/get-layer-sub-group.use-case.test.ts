import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetLayerSubGroupUseCase } from '../../../../../src/application/use-cases/layer-sub-groups/get-layer-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetLayerSubGroupUseCase', () => {
  let useCase: GetLayerSubGroupUseCase;
  let repository: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn() };
    useCase = new GetLayerSubGroupUseCase(repository as any);
  });

  it('should return a sub-group by id', async () => {
    const sg = { id: 'sg-1', name: 'Sub LayerGroup' };
    repository.findById.mockResolvedValue(sg);

    const result = await useCase.execute('sg-1');
    expect(result).toEqual(sg);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
