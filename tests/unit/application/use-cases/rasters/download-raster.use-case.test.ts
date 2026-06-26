import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadRasterUseCase } from '../../../../../src/application/use-cases/rasters/download-raster.use-case.js';

describe('DownloadRasterUseCase', () => {
  let useCase: DownloadRasterUseCase;
  let rasterService: { downloadRaster: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    rasterService = { downloadRaster: vi.fn() };
    useCase = new DownloadRasterUseCase(rasterService as any);
  });

  it('should download raster with default GTiff format', async () => {
    rasterService.downloadRaster.mockResolvedValue('/tmp/geosm-data/exports/my_table.tif');

    const result = await useCase.execute('my_table');

    expect(result).toEqual({ path: '/tmp/geosm-data/exports/my_table.tif', tableName: 'my_table' });
    expect(rasterService.downloadRaster).toHaveBeenCalledWith(
      'my_table',
      expect.stringContaining('my_table.tif'),
      'GTiff',
    );
  });

  it('should use .img extension for non-GTiff format', async () => {
    rasterService.downloadRaster.mockResolvedValue('/path/out.img');

    await useCase.execute('tbl', 'HFA');

    expect(rasterService.downloadRaster).toHaveBeenCalledWith(
      'tbl',
      expect.stringContaining('tbl.img'),
      'HFA',
    );
  });

  it('should propagate service errors', async () => {
    rasterService.downloadRaster.mockRejectedValue(new Error('GDAL failed'));
    await expect(useCase.execute('tbl')).rejects.toThrow('GDAL failed');
  });
});
