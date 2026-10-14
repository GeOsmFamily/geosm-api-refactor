import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteLayerSubGroupUseCase } from '../../../../../src/application/use-cases/layer-sub-groups/delete-layer-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('DeleteLayerSubGroupUseCase', () => {
  let useCase: DeleteLayerSubGroupUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), delete: vi.fn() };
    useCase = new DeleteLayerSubGroupUseCase(repository as any);
  });

  it('should delete an existing sub-group', async () => {
    repository.findById.mockResolvedValue({ id: 'sg-1' });
    repository.delete.mockResolvedValue(undefined);

    await useCase.execute('sg-1');
    expect(repository.delete).toHaveBeenCalledWith('sg-1');
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
