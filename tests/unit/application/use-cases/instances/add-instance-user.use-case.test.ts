import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddInstanceUserUseCase } from '../../../../../src/application/use-cases/instances/add-instance-user.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';
import { Role } from '../../../../../src/domain/enums.js';

describe('AddInstanceUserUseCase', () => {
  let useCase: AddInstanceUserUseCase;
  let instanceRepository: IInstanceRepository;
  let userRepository: IUserRepository;
  const now = new Date();
  const mockInstance = new Instance({ id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });
  const mockUser = new User({ id: 'u1', email: 'a@b.com', passwordHash: 'h', firstName: 'A', lastName: 'B', avatar: null, role: Role.VIEWER, isActive: true, emailVerifiedAt: now, lastLoginAt: null, createdAt: now, updatedAt: now });

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    userRepository = {
      findById: vi.fn(), findByEmail: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), existsByEmail: vi.fn(),
    };
    useCase = new AddInstanceUserUseCase(instanceRepository, userRepository);
  });

  it('should add user to instance successfully', async () => {
    const record = { id: 'iu-1', userId: 'u1', instanceId: 'inst-1', role: Role.VIEWER, createdAt: now, updatedAt: now };
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue(null);
    vi.mocked(instanceRepository.addInstanceUser).mockResolvedValue(record);

    const result = await useCase.execute('inst-1', { userId: 'u1' });
    expect(result).toEqual(record);
  });

  it('should throw NotFoundError if instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bad', { userId: 'u1' })).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError if user not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(userRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('inst-1', { userId: 'bad' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if user already a member', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);
    vi.mocked(instanceRepository.findInstanceUser).mockResolvedValue({ id: 'iu-1', userId: 'u1', instanceId: 'inst-1', role: Role.VIEWER, createdAt: now, updatedAt: now });
    await expect(useCase.execute('inst-1', { userId: 'u1' })).rejects.toThrow(ConflictError);
  });
});
