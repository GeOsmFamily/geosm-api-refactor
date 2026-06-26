import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInstanceUseCase } from '../../../../../src/application/use-cases/instances/get-instance.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';

describe('GetInstanceUseCase', () => {
  let useCase: GetInstanceUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({ id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new GetInstanceUseCase(instanceRepository);
  });

  it('should return instance when found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    const result = await useCase.execute('inst-1');
    expect(result).toBe(mockInstance);
  });

  it('should throw NotFoundError when instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bad-id')).rejects.toThrow(NotFoundError);
  });
});
