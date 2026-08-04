import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunRasterAnalysisUseCase } from '../../../../../src/application/use-cases/rasters/run-raster-analysis.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { QueueService } from '../../../../../src/infrastructure/queue/queue.service.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import type { PrismaClient } from '@prisma/client';

describe('RunRasterAnalysisUseCase', () => {
  let layerRepository: ILayerRepository;
  let queueService: QueueService;
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
    queueService = { addJob: vi.fn().mockResolvedValue({ id: 'job-1' }) } as any;
  });

  it('should create a pending result and enqueue the job for a raster layer', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer());
    const mockPrisma = {
      rasterAnalysisResult: { create: vi.fn().mockResolvedValue({ id: 'result-1' }) },
    } as unknown as PrismaClient;

    const useCase = new RunRasterAnalysisUseCase(mockPrisma, layerRepository, queueService);
    const result = await useCase.execute('layer-1', 'zonal');

    expect(result).toEqual({ resultId: 'result-1' });
    expect(mockPrisma.rasterAnalysisResult.create).toHaveBeenCalledWith({
      data: { layerId: 'layer-1', type: 'zonal', status: 'PENDING' },
    });
    expect(queueService.addJob).toHaveBeenCalledWith('raster-analysis', 'run', {
      resultId: 'result-1',
      layerId: 'layer-1',
      type: 'zonal',
      instanceId: 'inst-1',
    });
  });

  it('should throw NotFoundError when the layer does not exist', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(null);
    const mockPrisma = {
      rasterAnalysisResult: { create: vi.fn() },
    } as unknown as PrismaClient;

    const useCase = new RunRasterAnalysisUseCase(mockPrisma, layerRepository, queueService);
    await expect(useCase.execute('missing', 'global')).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when the layer is not a raster', async () => {
    vi.mocked(layerRepository.findById).mockResolvedValue(makeLayer(null));
    const mockPrisma = {
      rasterAnalysisResult: { create: vi.fn() },
    } as unknown as PrismaClient;

    const useCase = new RunRasterAnalysisUseCase(mockPrisma, layerRepository, queueService);
    await expect(useCase.execute('layer-1', 'global')).rejects.toThrow(ValidationError);
    expect(queueService.addJob).not.toHaveBeenCalled();
  });
});
