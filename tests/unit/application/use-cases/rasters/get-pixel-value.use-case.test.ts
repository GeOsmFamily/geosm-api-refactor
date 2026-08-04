import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetPixelValueUseCase } from '../../../../../src/application/use-cases/rasters/get-pixel-value.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../../../src/infrastructure/database/postgis.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('GetPixelValueUseCase', () => {
  let useCase: GetPixelValueUseCase;
  let layerRepository: ILayerRepository;
  let postGISService: PostGISService;
  const now = new Date();

  const makeLayer = (metadata: Record<string, unknown> | null = { source: 'raster' }) =>
    new Layer({
      id: 'layer-1',
      name: 'Population',
      slug: 'population',
      description: null,
      geometryType: GeometryType.POLYGON,
      sourceType: SourceType.WMS,
      sourceUrl: null,
      sourceLayer: null,
      tableName: 'population',
      schemaName: 'rasters',
      minZoom: 0,
      maxZoom: 22,
      isVisible: true,
      isQueryable: false,
      opacity: 1,
      order: 0,
      metadata,
      subGroupId: 'sg-1',
      instanceId: 'inst-1',
      qgisProjectId: null,
      createdAt: now,
      updatedAt: now,
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
    postGISService = { getPixelValue: vi.fn().mockResolvedValue(267.47) } as any;
    useCase = new GetPixelValueUseCase(layerRepository, postGISService);
  });

  it('should return the pixel value for a raster layer', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer());

    const result = await useCase.execute('layer-1', 11.5174, 3.848);

    expect(result).toEqual({ value: 267.47 });
    expect(postGISService.getPixelValue).toHaveBeenCalledWith('rasters', 'population', 11.5174, 3.848);
  });

  it('should throw NotFoundError when the layer does not exist', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('missing', 0, 0)).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when the layer is not a raster', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer(null));
    await expect(useCase.execute('layer-1', 0, 0)).rejects.toThrow(ValidationError);
  });
});
