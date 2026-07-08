import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetSharedMapUseCase } from '../../../../../src/application/use-cases/sharing/get-shared-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetSharedMapUseCase', () => {
  let useCase: GetSharedMapUseCase;
  let repository: { findByShortCode: ReturnType<typeof vi.fn> };
  let instanceRepository: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByShortCode: vi.fn() };
    instanceRepository = { findById: vi.fn() };
    useCase = new GetSharedMapUseCase(repository as any, instanceRepository as any);
  });

  it('should return a shared map by short code, resolving the instance slug', async () => {
    const record = { id: 'sm-1', shortCode: 'abc', instanceId: 'inst-1', expiresAt: null };
    repository.findByShortCode.mockResolvedValue(record);
    instanceRepository.findById.mockResolvedValue({ id: 'inst-1', slug: 'cameroon' });

    const result = await useCase.execute('abc');
    expect(result).toEqual({ ...record, instanceSlug: 'cameroon' });
  });

  it('should return a null instanceSlug if the instance no longer exists', async () => {
    const record = { id: 'sm-1', shortCode: 'abc', instanceId: 'missing-inst', expiresAt: null };
    repository.findByShortCode.mockResolvedValue(record);
    instanceRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute('abc');
    expect(result.instanceSlug).toBeNull();
  });

  it('should throw NotFoundError if not found', async () => {
    repository.findByShortCode.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError if expired', async () => {
    repository.findByShortCode.mockResolvedValue({
      id: 'sm-1',
      shortCode: 'abc',
      instanceId: 'inst-1',
      expiresAt: new Date('2020-01-01'),
    });
    await expect(useCase.execute('abc')).rejects.toThrow(NotFoundError);
  });
});
