import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddFeatureUseCase } from '../../../../../src/application/use-cases/features/add-feature.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../../../src/infrastructure/database/postgis.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('AddFeatureUseCase', () => {
  let useCase: AddFeatureUseCase;
  let layerRepository: ILayerRepository;
  let postGISService: PostGISService;
  const now = new Date();

  const makeLayer = (overrides: Partial<{ tableName: string | null; schemaName: string | null }> = {}) =>
    new Layer({
      id: 'layer-1', name: 'Test', slug: 'test', description: null,
      geometryType: GeometryType.POINT, sourceType: SourceType.WFS,
      sourceUrl: null, sourceLayer: null,
      tableName: 'tableName' in overrides ? overrides.tableName : 'test_table',
      schemaName: 'schemaName' in overrides ? overrides.schemaName : 'test_schema',
      minZoom: 0, maxZoom: 22, isVisible: true, isQueryable: true, opacity: 1, order: 0,
      metadata: null, subGroupId: 'sg-1', instanceId: 'inst-1', qgisProjectId: null,
      createdAt: now, updatedAt: now,
    });

  beforeEach(() => {
    layerRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findBySubGroup: vi.fn(),
      findByInstance: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    postGISService = {
      insertFeature: vi.fn().mockResolvedValue(42),
    } as any;
    useCase = new AddFeatureUseCase(layerRepository, postGISService);
  });

  it('should insert a feature and return its id', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer());

    const result = await useCase.execute({
      layerId: 'layer-1',
      geometry: { type: 'Point', coordinates: [11, 3] },
      properties: { name: 'Test' },
    });

    expect(result).toEqual({ id: 42 });
    expect(postGISService.insertFeature).toHaveBeenCalledWith(
      'test_schema', 'test_table',
      expect.objectContaining({ type: 'Feature' }),
    );
  });

  it('should throw NotFoundError when layer not found', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ layerId: 'missing', geometry: {}, properties: {} }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when layer has no spatial table', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer({ tableName: null }));

    await expect(
      useCase.execute({ layerId: 'layer-1', geometry: {}, properties: {} }),
    ).rejects.toThrow(NotFoundError);
  });
});
