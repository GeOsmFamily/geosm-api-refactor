import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateGroupUseCase } from '../../../../../src/application/use-cases/groups/create-group.use-case.js';
import type { IGroupRepository } from '../../../../../src/domain/repositories/group.repository.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { Group } from '../../../../../src/domain/entities/group.entity.js';

describe('CreateGroupUseCase', () => {
  let useCase: CreateGroupUseCase;
  let groupRepository: IGroupRepository;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({ id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });

  beforeEach(() => {
    groupRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn(),
    };
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new CreateGroupUseCase(groupRepository, instanceRepository);
  });

  it('should create group successfully', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(groupRepository.findBySlug).mockResolvedValue(null);
    const created = new Group({ id: 'g1', name: 'Group', slug: 'group', description: null, icon: null, color: null, order: 0, isActive: true, instanceId: 'inst-1', createdAt: now, updatedAt: now });
    vi.mocked(groupRepository.create).mockResolvedValue(created);

    const result = await useCase.execute('inst-1', { name: 'Group', slug: 'group' });
    expect(result.name).toBe('Group');
  });

  it('should throw NotFoundError if instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bad-id', { name: 'G', slug: 'g' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if slug exists', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    const existing = new Group({ id: 'g1', name: 'G', slug: 'g', description: null, icon: null, color: null, order: 0, isActive: true, instanceId: 'inst-1', createdAt: now, updatedAt: now });
    vi.mocked(groupRepository.findBySlug).mockResolvedValue(existing);
    await expect(useCase.execute('inst-1', { name: 'G', slug: 'g' })).rejects.toThrow(ConflictError);
  });
});
