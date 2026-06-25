import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createExportProcessor } from '../../../../../src/infrastructure/queue/workers/export.worker.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('data')),
  unlink: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 2048 }),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('createExportProcessor', () => {
  let deps: {
    exportRepository: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    layerRepository: { findById: ReturnType<typeof vi.fn> };
    storageService: { uploadFile: ReturnType<typeof vi.fn> };
    notificationService: { notifyUser: ReturnType<typeof vi.fn> };
    ogr2ogrService: { exportToFile: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    deps = {
      exportRepository: {
        findById: vi.fn().mockResolvedValue({
          id: 'exp-1', format: 'GEOJSON', layerId: 'layer-1', userId: 'user-1', bbox: null,
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      layerRepository: {
        findById: vi.fn().mockResolvedValue({
          id: 'layer-1', schemaName: 'schema', tableName: 'table', name: 'Test',
        }),
      },
      storageService: { uploadFile: vi.fn().mockResolvedValue('exports/exp-1/export.geojson') },
      notificationService: { notifyUser: vi.fn() },
      ogr2ogrService: { exportToFile: vi.fn().mockResolvedValue('/tmp/export.geojson') },
    };
  });

  it('should return a processor function', () => {
    const processor = createExportProcessor(deps as any);
    expect(typeof processor).toBe('function');
  });

  it('should process an export successfully', async () => {
    const processor = createExportProcessor(deps as any);
    const job = {
      data: { exportId: 'exp-1', layerId: 'layer-1', userId: 'user-1', format: 'GEOJSON' },
    } as any;

    await processor(job);

    expect(deps.exportRepository.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'PROCESSING' }));
    expect(deps.ogr2ogrService.exportToFile).toHaveBeenCalled();
    expect(deps.storageService.uploadFile).toHaveBeenCalled();
    expect(deps.exportRepository.update).toHaveBeenCalledWith('exp-1', expect.objectContaining({ status: 'COMPLETED' }));
  });

  it('should throw when export record is not found', async () => {
    deps.exportRepository.findById.mockResolvedValue(null);
    const processor = createExportProcessor(deps as any);
    const job = {
      data: { exportId: 'missing', layerId: 'layer-1', userId: 'user-1', format: 'GEOJSON' },
    } as any;

    await expect(processor(job)).rejects.toThrow('Export missing not found');
    expect(deps.exportRepository.update).toHaveBeenCalledWith('missing', expect.objectContaining({ status: 'FAILED' }));
  });

  it('should throw when layer is not found', async () => {
    deps.layerRepository.findById.mockResolvedValue(null);
    const processor = createExportProcessor(deps as any);
    const job = {
      data: { exportId: 'exp-1', layerId: 'missing', userId: 'user-1', format: 'GEOJSON' },
    } as any;

    await expect(processor(job)).rejects.toThrow('Layer missing not found');
  });

  it('should throw when layer has no spatial table', async () => {
    deps.layerRepository.findById.mockResolvedValue({
      id: 'layer-1', schemaName: null, tableName: null, name: 'Test',
    });
    const processor = createExportProcessor(deps as any);
    const job = {
      data: { exportId: 'exp-1', layerId: 'layer-1', userId: 'user-1', format: 'GEOJSON' },
    } as any;

    await expect(processor(job)).rejects.toThrow('has no spatial table');
  });
});
