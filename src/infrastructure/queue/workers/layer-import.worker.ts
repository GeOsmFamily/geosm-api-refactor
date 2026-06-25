import type { Job } from 'bullmq';
import { logger } from '../../observability/logger.js';

export interface LayerImportJobData {
  exportId: string;
  layerId: string;
  userId: string;
  fileKey: string;
  originalFilename: string;
  format: string;
}

export function createLayerImportProcessor(deps: {
  exportRepository: { findById: (id: string) => Promise<unknown>; update: (id: string, data: Record<string, unknown>) => Promise<unknown> };
  storageService: { downloadFile: (key: string) => Promise<NodeJS.ReadableStream>; getFileInfo: (key: string) => Promise<{ size: number }> };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
}) {
  return async function processLayerImport(job: Job<LayerImportJobData>): Promise<void> {
    const { exportId, layerId, userId, fileKey, format } = job.data;
    logger.info('Processing layer import', { exportId, layerId, format });

    try {
      // Update status to PROCESSING
      await deps.exportRepository.update(exportId, { status: 'PROCESSING', startedAt: new Date() });
      deps.notificationService.notifyUser(userId, 'import:progress', { exportId, layerId, status: 'PROCESSING', progress: 0 });

      // Get file info
      const fileInfo = await deps.storageService.getFileInfo(fileKey);

      // Download and process file
      const stream = await deps.storageService.downloadFile(fileKey);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
      }
      const fileBuffer = Buffer.concat(chunks);

      deps.notificationService.notifyUser(userId, 'import:progress', { exportId, layerId, status: 'PROCESSING', progress: 50 });

      // Process based on format
      let featureCount = 0;
      if (format === 'GEOJSON') {
        const geojson = JSON.parse(fileBuffer.toString('utf-8'));
        featureCount = geojson.features?.length ?? 0;
      } else {
        // Placeholder for Shapefile/GeoPackage/KML/CSV processing
        // In production, this would invoke GDAL/OGR or PyQGIS
        logger.info(`Format ${format} processing placeholder - would use GDAL/PyQGIS`, { layerId });
        featureCount = 0;
      }

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
      });

      logger.info('Layer import completed', { exportId, layerId, featureCount });
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
    }
  };
}
