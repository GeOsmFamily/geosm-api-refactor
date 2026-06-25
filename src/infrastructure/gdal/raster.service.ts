import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';
import { logger } from '../observability/logger.js';
import { config } from '../../config/env.config.js';

const execAsync = promisify(exec);

export interface RasterInfo {
  width: number;
  height: number;
  bands: number;
  srid: number;
  format: string;
}

export interface ImportRasterResult {
  tableName: string;
  outputPath: string;
  info: RasterInfo;
}

export class RasterService {
  private readonly dataDir: string;
  private readonly dbUrl: string;

  constructor() {
    this.dataDir = process.env.DATA_DIR || '/tmp/geosm-data';
    this.dbUrl = config.DATABASE_URL;
  }

  private getPgConnectionString(): string {
    const url = new URL(this.dbUrl);
    return `PG:host=${url.hostname} port=${url.port || 5432} user=${url.username} password=${url.password} dbname=${url.pathname.slice(1).split('?')[0]}`;
  }

  async importRaster(filePath: string, tableName: string, options: { srid?: number; tileSize?: number } = {}): Promise<ImportRasterResult> {
    const srid = options.srid ?? 4326;
    const tileSize = options.tileSize ?? 256;
    const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const outputDir = path.join(this.dataDir, 'rasters');

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    const warpedPath = path.join(outputDir, `${safeTable}_warped.tif`);

    // Reproject with gdalwarp
    await execAsync(
      `gdalwarp -t_srs EPSG:${srid} -r bilinear "${filePath}" "${warpedPath}"`,
      { timeout: 600000 }
    );

    // Generate overviews
    await execAsync(
      `gdaladdo -r average "${warpedPath}" 2 4 8 16`,
      { timeout: 300000 }
    );

    // Import to PostGIS raster using raster2pgsql
    try {
      await execAsync(
        `raster2pgsql -s ${srid} -t ${tileSize}x${tileSize} -I -C -M "${warpedPath}" public."${safeTable}" | psql "${this.dbUrl}"`,
        { timeout: 600000 }
      );
    } catch (error) {
      logger.warn('raster2pgsql import skipped, keeping as GeoTIFF', { error: error instanceof Error ? error.message : String(error) });
    }

    const info = await this.getRasterInfo(warpedPath);

    return { tableName: safeTable, outputPath: warpedPath, info };
  }

  async addToWMS(rasterPath: string, layerName: string, projectPath: string): Promise<void> {
    logger.info('Registering raster in QGIS project', { rasterPath, layerName, projectPath });
    // QGIS project registration would be handled by QGISProjectService
  }

  async downloadRaster(tableName: string, outputPath: string, format: string = 'GTiff'): Promise<string> {
    const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const pgConn = this.getPgConnectionString();

    const outputDir = path.dirname(outputPath);
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    await execAsync(
      `gdal_translate -of ${format} "${pgConn}" -sql "SELECT rast FROM public.\\"${safeTable}\\"" "${outputPath}"`,
      { timeout: 300000 }
    );

    return outputPath;
  }

  async getRasterInfo(filePath: string): Promise<RasterInfo> {
    try {
      const { stdout } = await execAsync(`gdalinfo -json "${filePath}"`, { timeout: 30000 });
      const info = JSON.parse(stdout);
      return {
        width: info.size?.[0] ?? 0,
        height: info.size?.[1] ?? 0,
        bands: info.bands?.length ?? 0,
        srid: 4326,
        format: info.driverShortName ?? 'Unknown',
      };
    } catch {
      return { width: 0, height: 0, bands: 0, srid: 4326, format: 'Unknown' };
    }
  }

  async cleanup(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) await unlink(filePath);
    } catch { /* ignore */ }
  }
}
