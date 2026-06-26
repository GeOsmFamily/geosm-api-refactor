import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateMapCompositionUseCase } from '../../../../../src/application/use-cases/maps/update-map-composition.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('UpdateMapCompositionUseCase', () => {
  let useCase: UpdateMapCompositionUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), update: vi.fn() };
    useCase = new UpdateMapCompositionUseCase(repository as any);
  });

  it('should update an existing map composition', async () => {
    repository.findById.mockResolvedValue({ id: 'mc-1' });
    const updated = { id: 'mc-1', name: 'Updated' };
    repository.update.mockResolvedValue(updated);

    const result = await useCase.execute('mc-1', { name: 'Updated' });
    expect(result).toEqual(updated);
    expect(repository.update).toHaveBeenCalledWith('mc-1', { name: 'Updated' });
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});
