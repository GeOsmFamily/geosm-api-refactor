import type { Job } from 'bullmq';
import { readFile, unlink, stat } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import { logger } from '../../observability/logger.js';
import { exportCompletedTotal } from '../../observability/metrics.js';
import type { Ogr2OgrService } from '../../gdal/ogr2ogr.service.js';
import type { ExportFormat } from '../../../domain/enums.js';

export interface LayerExportJobData {
  exportId: string;
  layerId: string;
  userId: string;
  format: ExportFormat;
  bbox?: number[];
}

const FORMAT_TO_OGR: Record<string, { ogrFormat: 'GPKG' | 'GeoJSON' | 'ESRI Shapefile' | 'KML' | 'CSV'; ext: string }> = {
  GEOPACKAGE: { ogrFormat: 'GPKG', ext: '.gpkg' },
  GEOJSON: { ogrFormat: 'GeoJSON', ext: '.geojson' },
  SHAPEFILE: { ogrFormat: 'ESRI Shapefile', ext: '.shp' },
  KML: { ogrFormat: 'KML', ext: '.kml' },
  CSV: { ogrFormat: 'CSV', ext: '.csv' },
};

export function createExportProcessor(deps: {
  exportRepository: { findById: (id: string) => Promise<{ id: string; format: string; layerId: string; userId: string; bbox: number[] | null } | null>; update: (id: string, data: Record<string, unknown>) => Promise<unknown> };
  layerRepository: { findById: (id: string) => Promise<{ id: string; schemaName: string | null; tableName: string | null; name: string } | null> };
  storageService: { uploadFile: (key: string, data: Buffer) => Promise<string> };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
  ogr2ogrService: Ogr2OgrService;
}) {
  return async function processExport(job: Job<LayerExportJobData>): Promise<void> {
    const { exportId, layerId, userId, format } = job.data;
    logger.info('Processing layer export', { exportId, layerId, format });

    const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
    await mkdir(tmpDir, { recursive: true });

    const formatConfig = FORMAT_TO_OGR[format] || FORMAT_TO_OGR.GEOPACKAGE;
    const outputFileName = `export_${exportId}${formatConfig.ext}`;
    const outputPath = path.join(tmpDir, outputFileName);

    try {
      // Update status to PROCESSING
      await deps.exportRepository.update(exportId, { status: 'PROCESSING', startedAt: new Date() });
      deps.notificationService.notifyUser(userId, 'export:progress', { exportId, layerId, status: 'PROCESSING', progress: 0 });

      // Get export record and layer
      const exportRecord = await deps.exportRepository.findById(exportId);
      if (!exportRecord) throw new Error(`Export ${exportId} not found`);

      const layer = await deps.layerRepository.findById(layerId);
      if (!layer) throw new Error(`Layer ${layerId} not found`);
      if (!layer.schemaName || !layer.tableName) throw new Error(`Layer ${layerId} has no spatial table`);

      deps.notificationService.notifyUser(userId, 'export:progress', { exportId, layerId, status: 'PROCESSING', progress: 20 });

      // Use ogr2ogr to export PostGIS data to the requested format
      const bbox = exportRecord.bbox as [number, number, number, number] | null;
      await deps.ogr2ogrService.exportToFile({
        schema: layer.schemaName,
        table: layer.tableName,
        format: formatConfig.ogrFormat,
        outputPath,
        bbox: bbox ?? undefined,
      });

      deps.notificationService.notifyUser(userId, 'export:progress', { exportId, layerId, status: 'PROCESSING', progress: 70 });

      // Read the exported file and upload to MinIO
      const fileBuffer = await readFile(outputPath);
      const fileStats = await stat(outputPath);
      const minioKey = `exports/${exportId}/${outputFileName}`;
      await deps.storageService.uploadFile(minioKey, fileBuffer);

      deps.notificationService.notifyUser(userId, 'export:progress', { exportId, layerId, status: 'PROCESSING', progress: 90 });

      // Update export record with file path, size, and completed status
      await deps.exportRepository.update(exportId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        filePath: minioKey,
        fileSize: fileStats.size,
      });

      deps.notificationService.notifyUser(userId, 'export:completed', {
        exportId,
        layerId,
        status: 'COMPLETED',
        filePath: minioKey,
        fileSize: fileStats.size,
      });

      exportCompletedTotal.inc();
      logger.info('Layer export completed', { exportId, layerId, format, fileSize: fileStats.size });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Layer export failed', { exportId, layerId, error: errorMessage });

      await deps.exportRepository.update(exportId, {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      });

      deps.notificationService.notifyUser(userId, 'export:failed', {
        exportId,
        layerId,
        status: 'FAILED',
        error: errorMessage,
      });

      throw error;
    } finally {
      // Clean up temp file
      try { await unlink(outputPath); } catch { /* ignore */ }
    }
  };
}
