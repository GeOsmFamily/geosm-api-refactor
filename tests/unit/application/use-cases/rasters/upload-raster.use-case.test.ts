import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadRasterUseCase } from '../../../../../src/application/use-cases/rasters/upload-raster.use-case.js';

vi.mock('fs', () => ({
  createReadStream: vi.fn().mockReturnValue('mock-stream'),
}));

describe('UploadRasterUseCase', () => {
  let useCase: UploadRasterUseCase;
  let rasterService: { importRaster: ReturnType<typeof vi.fn> };
  let storageService: { uploadFile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    rasterService = { importRaster: vi.fn() };
    storageService = { uploadFile: vi.fn() };
    useCase = new UploadRasterUseCase(rasterService as any, storageService as any);
  });

  it('should import raster and upload to storage', async () => {
    const importResult = { outputPath: '/tmp/warped.tif', tableName: 'my_raster' };
    rasterService.importRaster.mockResolvedValue(importResult);
    storageService.uploadFile.mockResolvedValue(undefined);

    const result = await useCase.execute('/input.tif', 'my_raster', { srid: 4326 });

    expect(result).toEqual(importResult);
    expect(rasterService.importRaster).toHaveBeenCalledWith('/input.tif', 'my_raster', { srid: 4326 });
    expect(storageService.uploadFile).toHaveBeenCalledWith(
      'rasters/my_raster.tif',
      'mock-stream',
      'image/tiff',
    );
  });

  it('should still return result if storage upload fails', async () => {
    const importResult = { outputPath: '/tmp/warped.tif', tableName: 'tbl' };
    rasterService.importRaster.mockResolvedValue(importResult);
    storageService.uploadFile.mockRejectedValue(new Error('Storage down'));

    const result = await useCase.execute('/input.tif', 'tbl');
    expect(result).toEqual(importResult);
  });

  it('should propagate raster import errors', async () => {
    rasterService.importRaster.mockRejectedValue(new Error('Import failed'));
    await expect(useCase.execute('/bad.tif', 'tbl')).rejects.toThrow('Import failed');
  });
});
