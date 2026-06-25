import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetFeaturesUseCase } from '../../../../../src/application/use-cases/features/get-features.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../../../src/infrastructure/database/postgis.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('GetFeaturesUseCase', () => {
  let useCase: GetFeaturesUseCase;
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
      queryFeatures: vi.fn().mockResolvedValue({ type: 'FeatureCollection', features: [] }),
    } as any;
    useCase = new GetFeaturesUseCase(layerRepository, postGISService);
  });

  it('should return features for a valid layer', async () => {
    const layer = makeLayer();
    vi.mocked(layerRepository.findById).mockResolvedValue(layer);
    const fc = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, geometry: {}, properties: {} }] };
    vi.mocked(postGISService.queryFeatures).mockResolvedValue(fc);

    const result = await useCase.execute({ layerId: 'layer-1' });
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(postGISService.queryFeatures).toHaveBeenCalledWith(
      expect.objectContaining({ schema: 'test_schema', table: 'test_table' }),
    );
  });

  it('should throw NotFoundError when layer does not exist', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute({ layerId: 'missing' })).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when layer has no schemaName', async () => {
    const layer = makeLayer({ schemaName: null });
    vi.mocked(layerRepository.findById).mockResolvedValue(layer);

    await expect(useCase.execute({ layerId: 'layer-1' })).rejects.toThrow(NotFoundError);
  });

  it('should throw NotFoundError when layer has no tableName', async () => {
    const layer = makeLayer({ tableName: null });
    vi.mocked(layerRepository.findById).mockResolvedValue(layer);

    await expect(useCase.execute({ layerId: 'layer-1' })).rejects.toThrow(NotFoundError);
  });
});
