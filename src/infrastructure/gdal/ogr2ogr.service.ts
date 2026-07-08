import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../../config/env.config.js';
import { logger } from '../observability/logger.js';
import {
  ogr2ogrOperationsTotal,
  ogr2ogrOperationDurationSeconds,
} from '../observability/metrics.js';
import { existsSync } from 'fs';
import { mkdir, unlink } from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface ImportResult {
  featureCount: number;
  geometryType: string;
  srid: number;
  tableName: string;
  schemaName: string;
}

export interface ExportOptions {
  schema: string;
  table: string;
  format: 'GPKG' | 'GeoJSON' | 'ESRI Shapefile' | 'KML' | 'CSV';
  outputPath: string;
  sql?: string;
  bbox?: [number, number, number, number];
  srid?: number;
}

export class Ogr2OgrService {
  private readonly dbUrl: string;
  private readonly dataDir: string;

  constructor() {
    this.dbUrl = config.DATABASE_URL;
    this.dataDir = process.env.DATA_DIR || '/tmp/geosm-data';
  }

  private getPgConnectionString(): string {
    const url = new URL(this.dbUrl);
    return `PG:host=${url.hostname} port=${url.port || 5432} user=${url.username} password=${url.password} dbname=${url.pathname.slice(1).split('?')[0]}`;
  }

  // Import a file into PostGIS using ogr2ogr
  async importFile(
    filePath: string,
    schema: string,
    table: string,
    srid: number = 4326,
  ): Promise<ImportResult> {
    const pgConn = this.getPgConnectionString();
    const safeSchema = schema.replace(/[^a-zA-Z0-9_]/g, '');
    const safeTable = table.replace(/[^a-zA-Z0-9_]/g, '');

    // Detect input format
    const ext = path.extname(filePath).toLowerCase();
    let inputPath = filePath;

    // Handle zip files (shapefiles)
    if (ext === '.zip') {
      inputPath = `/vsizip/${filePath}`;
    }

    const cmd = [
      'ogr2ogr',
      '-f',
      '"PostgreSQL"',
      `"${pgConn}"`,
      `"${inputPath}"`,
      '-nln',
      `"${safeSchema}"."${safeTable}"`,
      '-overwrite',
      '-t_srs',
      `EPSG:${srid}`,
      '-lco',
      'GEOMETRY_NAME=geom',
      '-lco',
      'FID=id',
      '-lco',
      'PRECISION=NO',
      '-progress',
    ].join(' ');

    logger.info('Running ogr2ogr import', { schema: safeSchema, table: safeTable, file: filePath });
    const importEnd = ogr2ogrOperationDurationSeconds.startTimer({ operation: 'import' });

    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 1800000 }); // 30 min timeout
      ogr2ogrOperationsTotal.inc({ operation: 'import' });
      importEnd();
      logger.info('ogr2ogr import completed', { stdout: stdout.trim(), stderr: stderr.trim() });

      // Get feature count and geometry type via ogrinfo
      const info = await this.getFileInfo(filePath);

      return {
        featureCount: info.featureCount,
        geometryType: info.geometryType,
        srid,
        tableName: safeTable,
        schemaName: safeSchema,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('ogr2ogr import failed', { error: msg });
      throw new Error(`ogr2ogr import failed: ${msg}`);
    }
  }

  // Export PostGIS data to a file
  async exportToFile(options: ExportOptions): Promise<string> {
    const pgConn = this.getPgConnectionString();
    const outputDir = path.dirname(options.outputPath);

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    let sql: string;
    if (options.sql) {
      sql = options.sql;
    } else {
      const s = options.schema.replace(/[^a-zA-Z0-9_]/g, '');
      const t = options.table.replace(/[^a-zA-Z0-9_]/g, '');
      sql = `SELECT * FROM "${s}"."${t}"`;

      // bbox peut être un tableau vide ([] plutôt que null/undefined - la colonne
      // Prisma ne permet pas null) : ne pas construire une clause WHERE cassée dans ce cas.
      if (options.bbox?.length === 4) {
        const [minLon, minLat, maxLon, maxLat] = options.bbox;
        sql += ` WHERE geom && ST_MakeEnvelope(${minLon}, ${minLat}, ${maxLon}, ${maxLat}, 4326)`;
      }
    }

    const formatMap: Record<string, string> = {
      GPKG: 'GPKG',
      GeoJSON: 'GeoJSON',
      'ESRI Shapefile': 'ESRI Shapefile',
      KML: 'KML',
      CSV: 'CSV',
    };

    const outputFormat = formatMap[options.format] || 'GPKG';

    const cmd = [
      'ogr2ogr',
      '-f',
      `"${outputFormat}"`,
      `"${options.outputPath}"`,
      `"${pgConn}"`,
      '-sql',
      `"${sql.replace(/"/g, '\\"')}"`,
      '-t_srs',
      `EPSG:${options.srid || 4326}`,
    ].join(' ');

    logger.info('Running ogr2ogr export', { format: outputFormat, output: options.outputPath });
    const exportEnd = ogr2ogrOperationDurationSeconds.startTimer({ operation: 'export' });

    try {
      await execAsync(cmd, { timeout: 1800000 });
      ogr2ogrOperationsTotal.inc({ operation: 'export' });
      exportEnd();
      logger.info('ogr2ogr export completed', { output: options.outputPath });
      return options.outputPath;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('ogr2ogr export failed', { error: msg });
      throw new Error(`ogr2ogr export failed: ${msg}`);
    }
  }

  // Get info about a geospatial file
  async getFileInfo(
    filePath: string,
  ): Promise<{ featureCount: number; geometryType: string; srid: number; fields: string[] }> {
    const ext = path.extname(filePath).toLowerCase();
    let inputPath = filePath;
    if (ext === '.zip') inputPath = `/vsizip/${filePath}`;

    try {
      const { stdout } = await execAsync(`ogrinfo -al -so "${inputPath}"`, { timeout: 60000 });

      const featureCountMatch = stdout.match(/Feature Count:\s*(\d+)/);
      const geomTypeMatch = stdout.match(/Geometry:\s*(\w+)/);
      const sridMatch = stdout.match(/EPSG[:\s]*(\d+)/);

      const fields: string[] = [];
      const fieldMatches = stdout.matchAll(/^(\w+):\s+\w+/gm);
      for (const match of fieldMatches) {
        if (!['Geometry', 'Feature'].includes(match[1])) {
          fields.push(match[1]);
        }
      }

      return {
        featureCount: featureCountMatch ? parseInt(featureCountMatch[1]) : 0,
        geometryType: geomTypeMatch ? geomTypeMatch[1] : 'Unknown',
        srid: sridMatch ? parseInt(sridMatch[1]) : 4326,
        fields,
      };
    } catch {
      return { featureCount: 0, geometryType: 'Unknown', srid: 4326, fields: [] };
    }
  }

  // Create GPKG from PostGIS SQL (like the old carto service)
  async createGpkgFromSql(sql: string, outputPath: string): Promise<string> {
    return this.exportToFile({
      schema: '',
      table: '',
      format: 'GPKG',
      outputPath,
      sql,
      srid: 4326,
    });
  }

  // Clean up temporary files
  async cleanup(filePath: string): Promise<void> {
    try {
      if (existsSync(filePath)) await unlink(filePath);
    } catch {
      /* ignore */
    }
  }
}
