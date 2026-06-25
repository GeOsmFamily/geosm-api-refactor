import { describe, it, expect, vi } from 'vitest';
import { ImportLayerUseCase } from '../../src/application/use-cases/layers/import-layer.use-case.js';

describe('ImportLayerUseCase', () => {
  it('should queue an import job', async () => {
    const layerRepo = { findById: vi.fn().mockResolvedValue({ id: 'layer-1', name: 'Test' }) };
    const exportRepo = { create: vi.fn().mockResolvedValue({ id: 'export-1' }) };
    const storageService = { uploadFile: vi.fn().mockResolvedValue('imports/layer-1/file.geojson') };
    const queueService = { addJob: vi.fn().mockResolvedValue({ id: 'job-1' }) };

    const useCase = new ImportLayerUseCase(layerRepo, exportRepo, storageService, queueService);
    const result = await useCase.execute({
      layerId: 'layer-1',
      userId: 'user-1',
      fileBuffer: Buffer.from('{"type":"FeatureCollection","features":[]}'),
      filename: 'test.geojson',
      mimetype: 'application/geo+json',
      format: 'GEOJSON',
    });

    expect(result.exportId).toBe('export-1');
    expect(result.message).toContain('queued');
    expect(storageService.uploadFile).toHaveBeenCalled();
    expect(queueService.addJob).toHaveBeenCalledWith('layer-import', 'import', expect.objectContaining({ layerId: 'layer-1' }));
  });

  it('should throw NotFoundError for non-existent layer', async () => {
    const layerRepo = { findById: vi.fn().mockResolvedValue(null) };
    const exportRepo = { create: vi.fn() };
    const storageService = { uploadFile: vi.fn() };
    const queueService = { addJob: vi.fn() };

    const useCase = new ImportLayerUseCase(layerRepo, exportRepo, storageService, queueService);
    await expect(useCase.execute({
      layerId: 'nonexistent',
      userId: 'user-1',
      fileBuffer: Buffer.from('{}'),
      filename: 'test.geojson',
      mimetype: 'application/json',
      format: 'GEOJSON',
    })).rejects.toThrow('not found');
  });
});

describe('DownloadExportUseCase', () => {
  it('should return a download URL', async () => {
    const { DownloadExportUseCase } = await import('../../src/application/use-cases/exports/download-export.use-case.js');
    const exportRepo = { findById: vi.fn().mockResolvedValue({ id: 'e1', status: 'COMPLETED', filePath: 'exports/file.zip', userId: 'user-1' }) };
    const storageService = { getPresignedUrl: vi.fn().mockResolvedValue('https://minio/presigned-url') };

    const useCase = new DownloadExportUseCase(exportRepo, storageService);
    const result = await useCase.execute('e1', 'user-1');

    expect(result.downloadUrl).toBe('https://minio/presigned-url');
    expect(storageService.getPresignedUrl).toHaveBeenCalledWith('exports/file.zip', 3600);
  });

  it('should throw ForbiddenError for wrong user', async () => {
    const { DownloadExportUseCase } = await import('../../src/application/use-cases/exports/download-export.use-case.js');
    const exportRepo = { findById: vi.fn().mockResolvedValue({ id: 'e1', status: 'COMPLETED', filePath: 'file', userId: 'user-1' }) };
    const storageService = { getPresignedUrl: vi.fn() };

    const useCase = new DownloadExportUseCase(exportRepo, storageService);
    await expect(useCase.execute('e1', 'user-2')).rejects.toThrow();
  });
});
