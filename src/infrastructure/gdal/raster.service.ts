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
  /** Non-null si l'import PostGIS (raster2pgsql) a échoué - le raster reste malgré tout
   * utilisable (le fichier GeoTIFF reprojeté existe et peut être servi en WMS), mais aucune
   * copie n'existe dans une table PostGIS raster. */
  postgisWarning: string | null;
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

    // Import to PostGIS raster using raster2pgsql - best-effort : le rendu WMS du raster
    // (voir add_raster_layer.py) se fait directement depuis le fichier GeoTIFF reprojeté, pas
    // depuis cette table, donc un échec ici n'empêche pas le raster d'être servi ; mais on
    // remonte l'échec à l'appelant plutôt que de l'avaler silencieusement comme avant.
    // psql (contrairement à Prisma) rejette le paramètre "?schema=" que DATABASE_URL contient
    // toujours - on le retire avant de le lui passer.
    let postgisWarning: string | null = null;
    try {
      const psqlUrl = this.dbUrl.split('?')[0];
      await execAsync(
        `raster2pgsql -s ${srid} -t ${tileSize}x${tileSize} -I -C -M "${warpedPath}" public."${safeTable}" | psql "${psqlUrl}"`,
        { timeout: 600000 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('raster2pgsql import failed, keeping as GeoTIFF only', { error: message });
      postgisWarning = message;
    }

    const info = await this.getRasterInfo(warpedPath);

    return { tableName: safeTable, outputPath: warpedPath, info, postgisWarning };
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
