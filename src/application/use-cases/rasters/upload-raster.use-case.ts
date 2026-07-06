import { createReadStream } from 'fs';
import { RasterService } from '../../../infrastructure/gdal/raster.service.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UploadRasterUseCase');

export class UploadRasterUseCase {
  constructor(
    private readonly rasterService: RasterService,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(filePath: string, tableName: string, options?: { srid?: number }) {
    logger.info('Importing raster', { tableName, srid: options?.srid });
    const result = await this.rasterService.importRaster(filePath, tableName, options);
    logger.info('Raster imported', { tableName: result.tableName });
    // Upload the warped file to MinIO for archival
    try {
      const stream = createReadStream(result.outputPath);
      await this.storageService.uploadFile(`rasters/${result.tableName}.tif`, stream, 'image/tiff');
      logger.info('Raster archived to storage', { tableName: result.tableName });
    } catch (err) {
      logger.error('Raster archival to storage failed', { tableName: result.tableName, error: err instanceof Error ? err.message : String(err) });
      /* storage optional */
    }
    return result;
  }
}
