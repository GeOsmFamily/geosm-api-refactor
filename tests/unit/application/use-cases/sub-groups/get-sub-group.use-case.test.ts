import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSubGroupUseCase } from '../../../../../src/application/use-cases/sub-groups/get-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetSubGroupUseCase', () => {
  let useCase: GetSubGroupUseCase;
  let repository: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn() };
    useCase = new GetSubGroupUseCase(repository as any);
  });

  it('should return a sub-group by id', async () => {
    const sg = { id: 'sg-1', name: 'Sub Group' };
    repository.findById.mockResolvedValue(sg);

    const result = await useCase.execute('sg-1');
    expect(result).toEqual(sg);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
