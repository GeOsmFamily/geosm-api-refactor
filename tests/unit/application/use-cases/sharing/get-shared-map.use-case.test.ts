import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSharedMapUseCase } from '../../../../../src/application/use-cases/sharing/get-shared-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetSharedMapUseCase', () => {
  let useCase: GetSharedMapUseCase;
  let repository: { findByShortCode: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByShortCode: vi.fn() };
    useCase = new GetSharedMapUseCase(repository as any);
  });

  it('should return a shared map by short code', async () => {
    const record = { id: 'sm-1', shortCode: 'abc', expiresAt: null };
    repository.findByShortCode.mockResolvedValue(record);

    const result = await useCase.execute('abc');
    expect(result).toEqual(record);
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findByShortCode.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError if expired', async () => {
    repository.findByShortCode.mockResolvedValue({
      id: 'sm-1',
      shortCode: 'abc',
      expiresAt: new Date('2020-01-01'),
    });
    await expect(useCase.execute('abc')).rejects.toThrow(NotFoundError);
  });
});
