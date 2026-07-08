import { RasterService } from '../../../infrastructure/gdal/raster.service.js';
import path from 'path';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DownloadRasterUseCase');

export class DownloadRasterUseCase {
  constructor(private readonly rasterService: RasterService) {}

  async execute(tableName: string, format: string = 'GTiff') {
    const ext = format === 'GTiff' ? '.tif' : '.img';
    const outputPath = path.join(
      process.env.DATA_DIR || '/tmp/geosm-data',
      'exports',
      `${tableName}${ext}`,
    );
    logger.info('Downloading raster', { tableName, format });
    try {
      const result = await this.rasterService.downloadRaster(tableName, outputPath, format);
      logger.info('Raster downloaded', { tableName, format });
      return { path: result, tableName };
    } catch (err) {
      logger.error('Raster download failed', {
        tableName,
        format,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
