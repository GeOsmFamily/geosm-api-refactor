import type { Job } from 'bullmq';
import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { mkdir } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { logger } from '../../observability/logger.js';
import { importCompletedTotal } from '../../observability/metrics.js';
import type { PostGISService, GeoJSONFeature } from '../../database/postgis.service.js';
import type { Ogr2OgrService } from '../../gdal/ogr2ogr.service.js';

export interface LayerImportJobData {
  exportId: string;
  layerId: string;
  userId: string;
  fileKey: string;
  originalFilename: string;
  format: string;
}

export function createLayerImportProcessor(deps: {
  exportRepository: {
    findById: (id: string) => Promise<unknown>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  };
  layerRepository: {
    findById: (
      id: string,
    ) => Promise<{
      id: string;
      schemaName: string | null;
      tableName: string | null;
      geometryType: string;
      instanceId: string;
      name: string;
    } | null>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  };
  storageService: {
    downloadFile: (key: string) => Promise<NodeJS.ReadableStream>;
    getFileInfo: (key: string) => Promise<{ size: number }>;
  };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
  postGISService: PostGISService;
  ogr2ogrService: Ogr2OgrService;
}) {
  return async function processLayerImport(job: Job<LayerImportJobData>): Promise<void> {
    const { exportId, layerId, userId, fileKey, originalFilename, format } = job.data;
    logger.info('Processing layer import', { exportId, layerId, format });

    const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
    await mkdir(tmpDir, { recursive: true });
    const tmpFilePath = path.join(tmpDir, `import_${exportId}_${originalFilename}`);

    try {
      // Update status to PROCESSING
      await deps.exportRepository.update(exportId, { status: 'PROCESSING', startedAt: new Date() });
      deps.notificationService.notifyUser(userId, 'import:progress', {
        exportId,
        layerId,
        status: 'PROCESSING',
        progress: 0,
      });

      // Get layer info
      const layer = await deps.layerRepository.findById(layerId);
      if (!layer) throw new Error(`Layer ${layerId} not found`);

      // Download file from MinIO to temp location
      const stream = await deps.storageService.downloadFile(fileKey);
      const writeStream = createWriteStream(tmpFilePath);
      await pipeline(stream, writeStream);

      deps.notificationService.notifyUser(userId, 'import:progress', {
        exportId,
        layerId,
        status: 'PROCESSING',
        progress: 20,
      });

      // Determine schema and table names
      const schemaName = layer.schemaName || `instance_${layer.instanceId.replace(/-/g, '_')}`;
      const tableName = layer.tableName || `layer_${layer.id.replace(/-/g, '_')}`;

      // Ensure schema exists
      await deps.postGISService.createSchema(schemaName);

      deps.notificationService.notifyUser(userId, 'import:progress', {
        exportId,
        layerId,
        status: 'PROCESSING',
        progress: 30,
      });

      let featureCount = 0;

      if (format === 'GEOJSON') {
        // For GeoJSON: parse and insert features directly via PostGIS service
        const { readFile } = await import('fs/promises');
        const fileContent = await readFile(tmpFilePath, 'utf-8');
        const geojson = JSON.parse(fileContent);

        const geometryType = layer.geometryType || 'GEOMETRY';
        await deps.postGISService.createSpatialTable(schemaName, tableName, geometryType);

        deps.notificationService.notifyUser(userId, 'import:progress', {
          exportId,
          layerId,
          status: 'PROCESSING',
          progress: 50,
        });

        const features: GeoJSONFeature[] = geojson.features || [];
        featureCount = await deps.postGISService.insertFeatures(schemaName, tableName, features);

        deps.notificationService.notifyUser(userId, 'import:progress', {
          exportId,
          layerId,
          status: 'PROCESSING',
          progress: 80,
        });
      } else {
        // For Shapefile/GPKG/KML/CSV: use ogr2ogr to import into PostGIS
        const importResult = await deps.ogr2ogrService.importFile(
          tmpFilePath,
          schemaName,
          tableName,
        );
        featureCount = importResult.featureCount;

        deps.notificationService.notifyUser(userId, 'import:progress', {
          exportId,
          layerId,
          status: 'PROCESSING',
          progress: 80,
        });
      }

      // Update the layer's tableName and schemaName in the database
      await deps.layerRepository.update(layerId, {
        tableName,
        schemaName,
      });

      // Compute layer stats
      const stats = await deps.postGISService.getLayerStats(schemaName, tableName);

      // Update layer metadata with stats
      await deps.layerRepository.update(layerId, {
        metadata: {
          featureCount: stats.featureCount,
          totalArea: stats.totalArea,
          totalLength: stats.totalLength,
          bbox: stats.bbox,
          importedAt: new Date().toISOString(),
          originalFilename,
        },
      });

      deps.notificationService.notifyUser(userId, 'import:progress', {
        exportId,
        layerId,
        status: 'PROCESSING',
        progress: 90,
      });

      // Get file info for size
      const fileInfo = await deps.storageService.getFileInfo(fileKey);

      // Update export as completed
      await deps.exportRepository.update(exportId, {
        status: 'COMPLETED',
        completedAt: new Date(),
        fileSize: fileInfo.size,
        filePath: fileKey,
      });

      deps.notificationService.notifyUser(userId, 'import:completed', {
        exportId,
        layerId,
        status: 'COMPLETED',
        featureCount,
        fileSize: fileInfo.size,
        stats,
      });

      importCompletedTotal.inc();
      logger.info('Layer import completed', { exportId, layerId, featureCount, stats });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Layer import failed', { exportId, layerId, error: errorMessage });

      await deps.exportRepository.update(exportId, {
        status: 'FAILED',
        errorMessage,
        completedAt: new Date(),
      });

      deps.notificationService.notifyUser(userId, 'import:failed', {
        exportId,
        layerId,
        status: 'FAILED',
        error: errorMessage,
      });

      throw error;
    } finally {
      // Clean up temp file
      try {
        await unlink(tmpFilePath);
      } catch {
        /* ignore */
      }
    }
  };
}
