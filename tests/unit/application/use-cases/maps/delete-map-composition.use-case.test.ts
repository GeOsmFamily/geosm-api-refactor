import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMapCompositionUseCase } from '../../../../../src/application/use-cases/maps/delete-map-composition.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('DeleteMapCompositionUseCase', () => {
  let useCase: DeleteMapCompositionUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), delete: vi.fn() };
    useCase = new DeleteMapCompositionUseCase(repository as any);
  });

  it('should delete an existing map composition', async () => {
    repository.findById.mockResolvedValue({ id: 'mc-1' });
    repository.delete.mockResolvedValue(undefined);

    await useCase.execute('mc-1');

    expect(repository.findById).toHaveBeenCalledWith('mc-1');
    expect(repository.delete).toHaveBeenCalledWith('mc-1');
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
