import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateLayerUseCase } from '../../../../../src/application/use-cases/layers/create-layer.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';

describe('CreateLayerUseCase', () => {
  let useCase: CreateLayerUseCase;
  let layerRepository: ILayerRepository;
  let instanceRepository: IInstanceRepository;
  const now = new Date();
  const mockInstance = new Instance({ id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null, centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now });

  beforeEach(() => {
    layerRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findBySubGroup: vi.fn(), findByInstance: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
    instanceRepository = {
      findById: vi.fn(), findBySlug: vi.fn(), findAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
      findInstanceUsers: vi.fn(), addInstanceUser: vi.fn(), removeInstanceUser: vi.fn(), changeInstanceUserRole: vi.fn(), findInstanceUser: vi.fn(),
    };
    useCase = new CreateLayerUseCase(layerRepository, instanceRepository);
  });

  it('should create layer successfully', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    vi.mocked(layerRepository.findBySlug).mockResolvedValue(null);
    const created = new Layer({
      id: 'l1', name: 'Layer', slug: 'layer', description: null,
      geometryType: GeometryType.POINT, sourceType: SourceType.WMS,
      sourceUrl: null, sourceLayer: null, tableName: null, schemaName: null,
      minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true, opacity: 1,
      order: 0, metadata: null, subGroupId: 'sg1', instanceId: 'inst-1',
      qgisProjectId: null, createdAt: now, updatedAt: now,
    });
    vi.mocked(layerRepository.create).mockResolvedValue(created);

    const result = await useCase.execute('inst-1', {
      name: 'Layer', slug: 'layer', geometryType: GeometryType.POINT,
      sourceType: SourceType.WMS, subGroupId: 'sg1',
    });
    expect(result.name).toBe('Layer');
  });

  it('should throw NotFoundError if instance not found', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('bad', {
      name: 'L', slug: 'l', geometryType: GeometryType.POINT,
      sourceType: SourceType.WMS, subGroupId: 'sg1',
    })).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if slug exists', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(mockInstance);
    const existing = new Layer({
      id: 'l1', name: 'L', slug: 'l', description: null,
      geometryType: GeometryType.POINT, sourceType: SourceType.WMS,
      sourceUrl: null, sourceLayer: null, tableName: null, schemaName: null,
      minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true, opacity: 1,
      order: 0, metadata: null, subGroupId: 'sg1', instanceId: 'inst-1',
      qgisProjectId: null, createdAt: now, updatedAt: now,
    });
    vi.mocked(layerRepository.findBySlug).mockResolvedValue(existing);
    await expect(useCase.execute('inst-1', {
      name: 'L', slug: 'l', geometryType: GeometryType.POINT,
      sourceType: SourceType.WMS, subGroupId: 'sg1',
    })).rejects.toThrow(ConflictError);
  });
});
