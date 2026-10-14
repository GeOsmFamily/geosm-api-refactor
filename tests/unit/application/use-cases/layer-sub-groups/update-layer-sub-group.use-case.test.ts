import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateLayerSubGroupUseCase } from '../../../../../src/application/use-cases/layer-sub-groups/update-layer-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('UpdateLayerSubGroupUseCase', () => {
  let useCase: UpdateLayerSubGroupUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), update: vi.fn() };
    useCase = new UpdateLayerSubGroupUseCase(repository as any);
  });

  it('should update an existing sub-group', async () => {
    repository.findById.mockResolvedValue({ id: 'sg-1' });
    const updated = { id: 'sg-1', name: 'Updated' };
    repository.update.mockResolvedValue(updated);

    const result = await useCase.execute('sg-1', { name: 'Updated' });
    expect(result).toEqual(updated);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});
