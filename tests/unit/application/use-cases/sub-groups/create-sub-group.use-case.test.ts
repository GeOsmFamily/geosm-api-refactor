import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSubGroupUseCase } from '../../../../../src/application/use-cases/sub-groups/create-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { ISubGroupRepository } from '../../../../../src/domain/repositories/sub-group.repository.js';
import type { IGroupRepository } from '../../../../../src/domain/repositories/group.repository.js';
import { Group } from '../../../../../src/domain/entities/group.entity.js';
import { SubGroup } from '../../../../../src/domain/entities/sub-group.entity.js';

describe('CreateSubGroupUseCase', () => {
  let useCase: CreateSubGroupUseCase;
  let subGroupRepository: ISubGroupRepository;
  let groupRepository: IGroupRepository;
  const now = new Date();
  const mockGroup = new Group({
    id: 'g1', name: 'Group', slug: 'group', description: null, icon: null,
    color: null, order: 0, isActive: true, instanceId: 'i1', createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    subGroupRepository = { findById: vi.fn(), findBySlug: vi.fn(), findByGroup: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    groupRepository = { findById: vi.fn(), findBySlug: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateOrder: vi.fn() };
    useCase = new CreateSubGroupUseCase(subGroupRepository, groupRepository);
  });

  it('should create sub-group successfully', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(mockGroup);
    vi.mocked(subGroupRepository.findBySlug).mockResolvedValue(null);
    const mockSub = new SubGroup({ id: 'sg1', name: 'Sub', slug: 'sub', description: null, icon: null, order: 0, isActive: true, groupId: 'g1', createdAt: now, updatedAt: now });
    vi.mocked(subGroupRepository.create).mockResolvedValue(mockSub);
    const result = await useCase.execute('g1', { name: 'Sub', slug: 'sub' });
    expect(result.name).toBe('Sub');
  });

  it('should throw NotFoundError when group not found', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('g1', { name: 'Sub', slug: 'sub' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError when slug already exists', async () => {
    vi.mocked(groupRepository.findById).mockResolvedValue(mockGroup);
    vi.mocked(subGroupRepository.findBySlug).mockResolvedValue({} as any);
    await expect(useCase.execute('g1', { name: 'Sub', slug: 'sub' })).rejects.toThrow(ConflictError);
  });
});
