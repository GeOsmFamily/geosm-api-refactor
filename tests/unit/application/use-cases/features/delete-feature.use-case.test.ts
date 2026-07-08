import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteFeatureUseCase } from '../../../../../src/application/use-cases/features/delete-feature.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../../../src/infrastructure/database/postgis.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('DeleteFeatureUseCase', () => {
  let useCase: DeleteFeatureUseCase;
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
      getFeatureById: vi.fn(),
      deleteFeature: vi.fn().mockResolvedValue(undefined),
    } as unknown as PostGISService;
    useCase = new DeleteFeatureUseCase(layerRepository, postGISService);
  });

  it('should delete the feature when the layer and feature both exist', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer());
    vi.mocked(postGISService.getFeatureById).mockResolvedValue({ type: 'Feature', geometry: {}, properties: {} } as never);

    await useCase.execute('layer-1', 42);

    expect(postGISService.deleteFeature).toHaveBeenCalledWith('test_schema', 'test_table', 42);
  });

  it('should throw NotFoundError if the layer does not exist', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('missing-layer', 42)).rejects.toThrow(NotFoundError);
    expect(postGISService.deleteFeature).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the layer has no spatial table configured', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer({ schemaName: null }));

    await expect(useCase.execute('layer-1', 42)).rejects.toThrow(NotFoundError);
    expect(postGISService.deleteFeature).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the feature does not exist in the spatial table', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer());
    vi.mocked(postGISService.getFeatureById).mockResolvedValue(null);

    await expect(useCase.execute('layer-1', 999)).rejects.toThrow(NotFoundError);
    expect(postGISService.deleteFeature).not.toHaveBeenCalled();
  });
});
