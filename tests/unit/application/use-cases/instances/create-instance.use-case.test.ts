import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateInstanceUseCase } from '../../../../../src/application/use-cases/instances/create-instance.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';

describe('CreateInstanceUseCase', () => {
  let useCase: CreateInstanceUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new CreateInstanceUseCase(instanceRepository);
  });

  it('should create instance successfully', async () => {
    vi.mocked(instanceRepository.findBySlug).mockResolvedValue(null);
    const created = new Instance({ id: 'id', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });
    vi.mocked(instanceRepository.create).mockResolvedValue(created);

    const result = await useCase.execute({ name: 'Test', slug: 'test' });
    expect(result.name).toBe('Test');
    expect(instanceRepository.create).toHaveBeenCalled();
  });

  it('should throw ConflictError if slug exists', async () => {
    const existing = new Instance({ id: 'id', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });
    vi.mocked(instanceRepository.findBySlug).mockResolvedValue(existing);

    await expect(useCase.execute({ name: 'Test', slug: 'test' })).rejects.toThrow(ConflictError);
  });
});
