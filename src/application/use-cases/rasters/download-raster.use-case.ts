import { RasterService } from '../../../infrastructure/gdal/raster.service.js';
import path from 'path';

export class DownloadRasterUseCase {
  constructor(private readonly rasterService: RasterService) {}

  async execute(tableName: string, format: string = 'GTiff') {
    const ext = format === 'GTiff' ? '.tif' : '.img';
    const outputPath = path.join(process.env.DATA_DIR || '/tmp/geosm-data', 'exports', `${tableName}${ext}`);
    const result = await this.rasterService.downloadRaster(tableName, outputPath, format);
    return { path: result, tableName };
  }
}
