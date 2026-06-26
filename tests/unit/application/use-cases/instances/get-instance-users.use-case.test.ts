import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetInstanceUsersUseCase } from '../../../../../src/application/use-cases/instances/get-instance-users.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('GetInstanceUsersUseCase', () => {
  let useCase: GetInstanceUsersUseCase;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({ id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new GetInstanceUsersUseCase(instanceRepository);
  });

  it('should return instance users', async () => {
    const users = [{ id: 'iu-1', userId: 'u1', instanceId: 'inst-1', role: Role.VIEWER, createdAt: now, updatedAt: now }];
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(instanceRepository.findInstanceUsers).mockResolvedValue(users);

    const result = await useCase.execute('inst-1');
    expect(result).toEqual(users);
  });

  it('should throw NotFoundError when instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bad-id')).rejects.toThrow(NotFoundError);
  });
});
