import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMapCompositionUseCase } from '../../../../../src/application/use-cases/maps/get-map-composition.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetMapCompositionUseCase', () => {
  let useCase: GetMapCompositionUseCase;
  let repository: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn() };
    useCase = new GetMapCompositionUseCase(repository as any);
  });

  it('should return a map composition by id', async () => {
    const record = { id: 'mc-1', name: 'Map' };
    repository.findById.mockResolvedValue(record);

    const result = await useCase.execute('mc-1');
    expect(result).toEqual(record);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
