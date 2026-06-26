import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateBaseMapUseCase } from '../../../../../src/application/use-cases/base-maps/update-base-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('UpdateBaseMapUseCase', () => {
  let useCase: UpdateBaseMapUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), update: vi.fn() };
    useCase = new UpdateBaseMapUseCase(repository as any);
  });

  it('should update an existing base map', async () => {
    repository.findById.mockResolvedValue({ id: 'bm-1' });
    const updated = { id: 'bm-1', name: 'Updated' };
    repository.update.mockResolvedValue(updated);

    const result = await useCase.execute('bm-1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});
