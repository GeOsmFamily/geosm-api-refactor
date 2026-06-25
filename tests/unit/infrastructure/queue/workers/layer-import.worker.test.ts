import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLayerImportProcessor } from '../../../../../src/infrastructure/queue/workers/layer-import.worker.js';

vi.mock('fs', () => ({ createWriteStream: vi.fn(() => ({ on: vi.fn(), write: vi.fn(), end: vi.fn() })) }));
vi.mock('fs/promises', () => ({ unlink: vi.fn(), mkdir: vi.fn(), readFile: vi.fn() }));
vi.mock('stream/promises', () => ({ pipeline: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('createLayerImportProcessor', () => {
  let deps: {
    exportRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    layerRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    storageService: { downloadFile: ReturnType<typeof vi.fn>; getFileInfo: ReturnType<typeof vi.fn> };
    notificationService: { notifyUser: ReturnType<typeof vi.fn> };
    postGISService: {
      createSchema: ReturnType<typeof vi.fn>;
      createSpatialTable: ReturnType<typeof vi.fn>;
      insertFeatures: ReturnType<typeof vi.fn>;
      getLayerStats: ReturnType<typeof vi.fn>;
    };
    ogr2ogrService: { importFile: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    deps = {
      exportRepository: { findById: vi.fn(), update: vi.fn().mockResolvedValue(undefined) },
      layerRepository: {
        findById: vi.fn().mockResolvedValue({
          id: 'layer-1', schemaName: 'schema', tableName: 'table',
          geometryType: 'POINT', instanceId: 'inst-1', name: 'Test',
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      storageService: {
        downloadFile: vi.fn().mockResolvedValue({ pipe: vi.fn() }),
        getFileInfo: vi.fn().mockResolvedValue({ size: 1024 }),
      },
      notificationService: { notifyUser: vi.fn() },
      postGISService: {
        createSchema: vi.fn().mockResolvedValue(undefined),
        createSpatialTable: vi.fn().mockResolvedValue(undefined),
        insertFeatures: vi.fn().mockResolvedValue(5),
        getLayerStats: vi.fn().mockResolvedValue({ featureCount: 5, totalArea: null, totalLength: null, bbox: null }),
      },
      ogr2ogrService: {
        importFile: vi.fn().mockResolvedValue({ featureCount: 10, geometryType: 'POINT', srid: 4326, tableName: 'table', schemaName: 'schema' }),
      },
    };
  });

  it('should return a processor function', () => {
    const processor = createLayerImportProcessor(deps as any);
    expect(typeof processor).toBe('function');
  });

  it('should process a SHAPEFILE import using ogr2ogr', async () => {
    const processor = createLayerImportProcessor(deps as any);
    const job = {
      data: {
        exportId: 'exp-1', layerId: 'layer-1', userId: 'user-1',
        fileKey: 'uploads/file.shp', originalFilename: 'data.shp', format: 'SHAPEFILE',
      },
    } as any;

    await processor(job);

    expect(deps.exportRepository.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'PROCESSING' }));
    expect(deps.ogr2ogrService.importFile).toHaveBeenCalled();
    expect(deps.exportRepository.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('should throw when layer is not found', async () => {
    deps.layerRepository.findById.mockResolvedValue(null);
    const processor = createLayerImportProcessor(deps as any);
    const job = {
      data: {
        exportId: 'exp-1', layerId: 'missing', userId: 'user-1',
        fileKey: 'uploads/file.shp', originalFilename: 'data.shp', format: 'SHAPEFILE',
      },
    } as any;

    await expect(processor(job)).rejects.toThrow('Layer missing not found');
    expect(deps.exportRepository.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'FAILED' }));
  });
});
