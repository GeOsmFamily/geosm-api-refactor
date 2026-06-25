import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateInstanceUseCase } from '../../../../../src/application/use-cases/instances/update-instance.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';

describe('UpdateInstanceUseCase', () => {
  let useCase: UpdateInstanceUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({
    id: 'i1', name: 'Test', slug: 'test', description: null, logo: null,
    bbox: null, centerLat: null, centerLon: null, defaultZoom: 5, isActive: true,
    createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(),
      removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new UpdateInstanceUseCase(instanceRepository);
  });

  it('should update instance when found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    const updated = new Instance({ ...mockInstance, name: 'Updated' });
    vi.mocked(instanceRepository.update).mockResolvedValue(updated);
    const result = await useCase.execute('i1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('i1', { name: 'X' })).rejects.toThrow(NotFoundError);
  });
});
