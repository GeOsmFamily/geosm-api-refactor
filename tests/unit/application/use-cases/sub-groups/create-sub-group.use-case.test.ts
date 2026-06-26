import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateSubGroupUseCase } from '../../../../../src/application/use-cases/sub-groups/create-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('CreateSubGroupUseCase', () => {
  let useCase: CreateSubGroupUseCase;
  let subGroupRepo: { findBySlug: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let groupRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    subGroupRepo = { findBySlug: vi.fn(), create: vi.fn() };
    groupRepo = { findById: vi.fn() };
    useCase = new CreateSubGroupUseCase(subGroupRepo as any, groupRepo as any);
  });

  it('should create a sub-group successfully', async () => {
    groupRepo.findById.mockResolvedValue({ id: 'g-1' });
    subGroupRepo.findBySlug.mockResolvedValue(null);
    const created = { id: 'mock-uuid', name: 'Sub' };
    subGroupRepo.create.mockResolvedValue(created);

    const result = await useCase.execute('g-1', { name: 'Sub', slug: 'sub' });

    expect(result).toEqual(created);
    expect(subGroupRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-uuid',
        name: 'Sub',
        slug: 'sub',
        groupId: 'g-1',
        isActive: true,
      }),
    );
  });

  it('should throw NotFoundError if group does not exist', async () => {
    groupRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'x', slug: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if slug already exists in group', async () => {
    groupRepo.findById.mockResolvedValue({ id: 'g-1' });
    subGroupRepo.findBySlug.mockResolvedValue({ id: 'existing' });
    await expect(useCase.execute('g-1', { name: 'x', slug: 'x' })).rejects.toThrow(ConflictError);
  });
});
