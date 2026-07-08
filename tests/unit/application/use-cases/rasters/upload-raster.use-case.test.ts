import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadRasterUseCase } from '../../../../../src/application/use-cases/rasters/upload-raster.use-case.js';
import type { ILayerRepository } from '../../../../../src/domain/repositories/layer.repository.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { Layer } from '../../../../../src/domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../../../src/domain/enums.js';

vi.mock('fs', () => ({
  createReadStream: vi.fn().mockReturnValue('mock-stream'),
}));

describe('UploadRasterUseCase', () => {
  let useCase: UploadRasterUseCase;
  let rasterService: { importRaster: ReturnType<typeof vi.fn> };
  let storageService: { uploadFile: ReturnType<typeof vi.fn> };
  let qgisProjectService: { getProjectPath: ReturnType<typeof vi.fn>; addRasterLayer: ReturnType<typeof vi.fn> };
  let layerRepository: ILayerRepository;
  let instanceRepository: IInstanceRepository;
  const now = new Date();

  const mockInstance = new Instance({
    id: 'inst-1', name: 'Test', slug: 'test', description: null, logo: null, bbox: null,
    centerLat: null, centerLon: null, defaultZoom: 6, isActive: true, createdAt: now, updatedAt: now,
  });

  const mockLayer = new Layer({
    id: 'layer-1', name: 'My Raster', slug: 'my-raster', description: null,
    geometryType: GeometryType.POLYGON, sourceType: SourceType.WMS,
    sourceUrl: 'http://qgis/ows?map=test.qgs', sourceLayer: 'test_myraster', tableName: 'my_raster', schemaName: 'public',
    minZoom: 0, maxZoom: 22, isVisible: false, isQueryable: false, opacity: 1,
    order: 0, metadata: null, subGroupId: 'sg-1', instanceId: 'inst-1',
    qgisProjectId: null, createdAt: now, updatedAt: now,
  });

  const importResult = {
    tableName: 'my_raster',
    outputPath: '/tmp/warped.tif',
    info: { width: 100, height: 100, bands: 3, srid: 4326, format: 'GTiff' },
    postgisWarning: null,
  };

  beforeEach(() => {
    rasterService = { importRaster: vi.fn().mockResolvedValue(importResult) };
    storageService = { uploadFile: vi.fn().mockResolvedValue(undefined) };
    qgisProjectService = {
      getProjectPath: vi.fn().mockReturnValue('/projects/test/test.qgs'),
      addRasterLayer: vi.fn().mockResolvedValue({ success: true }),
    };
    layerRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(null),
      findBySubGroup: vi.fn(),
      findByInstance: vi.fn(),
      create: vi.fn().mockResolvedValue(mockLayer),
      update: vi.fn(),
      delete: vi.fn(),
    };
    instanceRepository = {
      findById: vi.fn().mockResolvedValue(mockInstance),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findInstanceUsers: vi.fn(),
      addInstanceUser: vi.fn(),
      removeInstanceUser: vi.fn(),
      changeInstanceUserRole: vi.fn(),
      findInstanceUser: vi.fn(),
    };
    useCase = new UploadRasterUseCase(
      rasterService as any,
      storageService as any,
      qgisProjectService as any,
      layerRepository,
      instanceRepository,
    );
  });

  const input = {
    filePath: '/input.tif',
    tableName: 'my_raster',
    instanceId: 'inst-1',
    subGroupId: 'sg-1',
    name: 'My Raster',
    srid: 4326,
  };

  it('should import raster, archive it, register it in QGIS and create a Layer', async () => {
    const result = await useCase.execute(input);

    expect(result.layer).toBe(mockLayer);
    expect(result.tableName).toBe('my_raster');
    expect(result.postgisImportWarning).toBeNull();
    expect(rasterService.importRaster).toHaveBeenCalledWith('/input.tif', 'my_raster', { srid: 4326 });
    expect(storageService.uploadFile).toHaveBeenCalledWith('rasters/my_raster.tif', 'mock-stream', 'image/tiff');
    expect(qgisProjectService.addRasterLayer).toHaveBeenCalledWith(
      '/projects/test/test.qgs',
      '/tmp/warped.tif',
      expect.any(String),
    );
    expect(layerRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-1', subGroupId: 'sg-1', sourceType: SourceType.WMS }),
    );
  });

  it('should still create the layer if storage archival fails (best-effort)', async () => {
    storageService.uploadFile.mockRejectedValue(new Error('Storage down'));
    const result = await useCase.execute(input);
    expect(result.layer).toBe(mockLayer);
  });

  it('should still create the layer if QGIS registration fails (raster stays imported but unserved)', async () => {
    qgisProjectService.addRasterLayer.mockResolvedValue({ success: false, error: 'boom' });
    const result = await useCase.execute(input);
    expect(result.layer).toBe(mockLayer);
  });

  it('should propagate raster import errors', async () => {
    rasterService.importRaster.mockRejectedValue(new Error('Import failed'));
    await expect(useCase.execute(input)).rejects.toThrow('Import failed');
  });

  it('should throw NotFoundError if instance does not exist', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
  });

  it('should throw ConflictError if a layer with this slug already exists in the instance', async () => {
    vi.mocked(layerRepository.findBySlug).mockResolvedValue(mockLayer);
    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });
});
