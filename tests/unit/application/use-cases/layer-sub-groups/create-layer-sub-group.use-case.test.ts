import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateLayerSubGroupUseCase } from '../../../../../src/application/use-cases/layer-sub-groups/create-layer-sub-group.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('CreateLayerSubGroupUseCase', () => {
  let useCase: CreateLayerSubGroupUseCase;
  let layerSubGroupRepo: { findBySlug: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let layerGroupRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    layerSubGroupRepo = { findBySlug: vi.fn(), create: vi.fn() };
    layerGroupRepo = { findById: vi.fn() };
    useCase = new CreateLayerSubGroupUseCase(layerSubGroupRepo as any, layerGroupRepo as any);
  });

  it('should create a sub-group successfully', async () => {
    layerGroupRepo.findById.mockResolvedValue({ id: 'g-1' });
    layerSubGroupRepo.findBySlug.mockResolvedValue(null);
    const created = { id: 'mock-uuid', name: 'Sub' };
    layerSubGroupRepo.create.mockResolvedValue(created);

    const result = await useCase.execute('g-1', { name: 'Sub', slug: 'sub' });

    expect(result).toEqual(created);
    expect(layerSubGroupRepo.create).toHaveBeenCalledWith(
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
    layerGroupRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing', { name: 'x', slug: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if slug already exists in group', async () => {
    layerGroupRepo.findById.mockResolvedValue({ id: 'g-1' });
    layerSubGroupRepo.findBySlug.mockResolvedValue({ id: 'existing' });
    await expect(useCase.execute('g-1', { name: 'x', slug: 'x' })).rejects.toThrow(ConflictError);
  });
});
