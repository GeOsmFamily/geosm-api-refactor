import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteBaseMapUseCase } from '../../../../../src/application/use-cases/base-maps/delete-base-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('DeleteBaseMapUseCase', () => {
  let useCase: DeleteBaseMapUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), delete: vi.fn() };
    useCase = new DeleteBaseMapUseCase(repository as any);
  });

  it('should delete an existing base map', async () => {
    repository.findById.mockResolvedValue({ id: 'bm-1' });
    repository.delete.mockResolvedValue(undefined);

    await useCase.execute('bm-1');
    expect(repository.delete).toHaveBeenCalledWith('bm-1');
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
