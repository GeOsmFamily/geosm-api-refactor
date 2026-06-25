import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateBaseMapUseCase } from '../../../../../src/application/use-cases/base-maps/create-base-map.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IBaseMapRepository } from '../../../../../src/domain/repositories/base-map.repository.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { BaseMap } from '../../../../../src/domain/entities/base-map.entity.js';
import { BaseMapType } from '../../../../../src/domain/enums.js';

describe('CreateBaseMapUseCase', () => {
  let useCase: CreateBaseMapUseCase;
  let baseMapRepository: IBaseMapRepository;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({
    id: 'i1', name: 'Test', slug: 'test', description: null, logo: null,
    bbox: null, centerLat: null, centerLon: null, defaultZoom: 5, isActive: true,
    createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    baseMapRepository = { findById: vi.fn(), findByInstance: vi.fn(), findDefaults: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(),
      removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new CreateBaseMapUseCase(baseMapRepository, instanceRepository);
  });

  it('should create base map when instance exists', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    const mockBaseMap = new BaseMap({
      id: 'bm1', name: 'OSM', slug: 'osm', type: BaseMapType.XYZ,
      url: 'https://tile.osm.org/{z}/{x}/{y}.png', thumbnail: null,
      attribution: null, isDefault: false, order: 0, config: null,
      instanceId: 'i1', createdAt: now, updatedAt: now,
    });
    vi.mocked(baseMapRepository.create).mockResolvedValue(mockBaseMap);
    const result = await useCase.execute('i1', { name: 'OSM', slug: 'osm', type: BaseMapType.XYZ, url: 'https://tile.osm.org/{z}/{x}/{y}.png' });
    expect(result.name).toBe('OSM');
  });

  it('should throw NotFoundError when instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('i1', { name: 'OSM', slug: 'osm', type: BaseMapType.XYZ, url: 'http://x' })).rejects.toThrow(NotFoundError);
  });
});
