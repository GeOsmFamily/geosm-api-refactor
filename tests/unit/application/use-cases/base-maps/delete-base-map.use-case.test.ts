import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteBaseMapUseCase } from '../../../../../src/application/use-cases/base-maps/delete-base-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IBaseMapRepository } from '../../../../../src/domain/repositories/base-map.repository.js';
import { BaseMap } from '../../../../../src/domain/entities/base-map.entity.js';
import { BaseMapType } from '../../../../../src/domain/enums.js';

describe('DeleteBaseMapUseCase', () => {
  let useCase: DeleteBaseMapUseCase;
  let baseMapRepository: IBaseMapRepository;
  const now = new Date();
  const mockBaseMap = new BaseMap({
    id: 'bm1', name: 'OSM', slug: 'osm', type: BaseMapType.XYZ,
    url: 'http://x', thumbnail: null, attribution: null, isDefault: false,
    order: 0, config: null, instanceId: 'i1', createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    baseMapRepository = { findById: vi.fn(), findByInstance: vi.fn(), findDefaults: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    useCase = new DeleteBaseMapUseCase(baseMapRepository);
  });

  it('should delete base map when found', async () => {
    vi.mocked(baseMapRepository.findById).mockResolvedValue(mockBaseMap);
    await useCase.execute('bm1');
    expect(baseMapRepository.delete).toHaveBeenCalledWith('bm1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(baseMapRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bm1')).rejects.toThrow(NotFoundError);
  });
});
