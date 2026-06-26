import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBaseMapUseCase } from '../../../../../src/application/use-cases/base-maps/create-base-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

vi.mock('uuid', () => ({ v4: () => 'mock-uuid' }));

describe('CreateBaseMapUseCase', () => {
  let useCase: CreateBaseMapUseCase;
  let baseMapRepo: { create: ReturnType<typeof vi.fn> };
  let instanceRepo: { findById: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    baseMapRepo = { create: vi.fn() };
    instanceRepo = { findById: vi.fn() };
    useCase = new CreateBaseMapUseCase(baseMapRepo as any, instanceRepo as any);
  });

  it('should create a base map successfully', async () => {
    instanceRepo.findById.mockResolvedValue({ id: 'inst-1' });
    const created = { id: 'mock-uuid', name: 'OSM' };
    baseMapRepo.create.mockResolvedValue(created);

    const result = await useCase.execute('inst-1', {
      name: 'OSM',
      slug: 'osm',
      type: 'XYZ' as any,
      url: 'https://tile.osm.org/{z}/{x}/{y}.png',
    });

    expect(result).toEqual(created);
    expect(baseMapRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'mock-uuid',
        name: 'OSM',
        slug: 'osm',
        instanceId: 'inst-1',
        isDefault: false,
        order: 0,
      }),
    );
  });

  it('should throw NotFoundError if instance does not exist', async () => {
    instanceRepo.findById.mockResolvedValue(null);
    await expect(
      useCase.execute('missing', { name: 'x', slug: 'x', type: 'XYZ' as any, url: 'http://x' }),
    ).rejects.toThrow(NotFoundError);
  });
});
