import { createReadStream } from 'fs';
import { RasterService } from '../../../infrastructure/gdal/raster.service.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';

export class UploadRasterUseCase {
  constructor(
    private readonly rasterService: RasterService,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(filePath: string, tableName: string, options?: { srid?: number }) {
    const result = await this.rasterService.importRaster(filePath, tableName, options);
    // Upload the warped file to MinIO for archival
    try {
      const stream = createReadStream(result.outputPath);
      await this.storageService.uploadFile(`rasters/${result.tableName}.tif`, stream, 'image/tiff');
    } catch { /* storage optional */ }
    return result;
  }
}
