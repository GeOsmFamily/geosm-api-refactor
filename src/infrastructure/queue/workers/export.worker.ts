import type { Job } from 'bullmq';
import { readFile, readdir, unlink, stat, mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { ZipArchive } from 'archiver';
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
  /** Quand renseigné, exporte uniquement cette feature (osm_id) plutôt que toute la couche. */
  featureId?: string;
  /** Export groupé : plusieurs couches zippées ensemble (voir isBulk). */
  layerIds?: string[];
  isBulk?: boolean;
}

// SHAPEFILE écrit sur ".shp" mais un shapefile n'est valide/utilisable qu'avec
// ses fichiers compagnons (.shx, .dbf, .prj...) - ext ci-dessous est le fichier
// que ogr2ogr écrit réellement, pas nécessairement l'extension finale livrée.
const FORMAT_TO_OGR: Record<
  string,
  { ogrFormat: 'GPKG' | 'GeoJSON' | 'ESRI Shapefile' | 'KML' | 'CSV'; ext: string }
> = {
  GEOPACKAGE: { ogrFormat: 'GPKG', ext: '.gpkg' },
  GEOJSON: { ogrFormat: 'GeoJSON', ext: '.geojson' },
  SHAPEFILE: { ogrFormat: 'ESRI Shapefile', ext: '.shp' },
  KML: { ogrFormat: 'KML', ext: '.kml' },
  CSV: { ogrFormat: 'CSV', ext: '.csv' },
};

type ExportWorkerDeps = {
  exportRepository: {
    findById: (
      id: string,
    ) => Promise<{
      id: string;
      format: string;
      layerId: string | null;
      bbox: number[] | null;
    } | null>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  };
  layerRepository: {
    findById: (
      id: string,
    ) => Promise<{
      id: string;
      schemaName: string | null;
      tableName: string | null;
      name: string;
    } | null>;
  };
  storageService: { uploadFile: (key: string, data: Buffer) => Promise<string> };
  notificationService: { notifyUser: (userId: string, event: string, data: unknown) => void };
  ogr2ogrService: Ogr2OgrService;
};

function extractDisplayName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed.fr || parsed.en || null;
    }
  } catch {
    // Pas du JSON - c'était déjà une chaîne d'affichage brute.
    return raw;
  }
  return raw;
}

async function zipFiles(
  entries: Array<{ path: string; name: string }>,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', (err: Error) => reject(err));
    archive.pipe(output);
    for (const entry of entries) {
      archive.file(entry.path, { name: entry.name });
    }
    archive.finalize();
  });
}

/** Fichiers compagnons produits par ogr2ogr pour un même export (même basename, extensions différentes). */
async function findSiblingFiles(outputPath: string): Promise<string[]> {
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath, path.extname(outputPath));
  const files = await readdir(dir);
  return files
    .filter((f) => f === `${base}${path.extname(outputPath)}` || f.startsWith(`${base}.`))
    .map((f) => path.join(dir, f));
}

export function createExportProcessor(deps: ExportWorkerDeps) {
  return async function processExport(job: Job<LayerExportJobData>): Promise<void> {
    if (job.data.isBulk) {
      return processBulkExport(job, deps);
    }
    return processSingleExport(job, deps);
  };
}

async function processSingleExport(
  job: Job<LayerExportJobData>,
  deps: ExportWorkerDeps,
): Promise<void> {
  const { exportId, layerId, userId, format, featureId } = job.data;
  logger.info('Processing layer export', { exportId, layerId, format });

  const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
  await mkdir(tmpDir, { recursive: true });

  const formatConfig = FORMAT_TO_OGR[format] || FORMAT_TO_OGR.GEOPACKAGE;
  const outputFileName = `export_${exportId}${formatConfig.ext}`;
  const outputPath = path.join(tmpDir, outputFileName);
  const cleanupPaths = [outputPath];

  try {
    await deps.exportRepository.update(exportId, { status: 'PROCESSING', startedAt: new Date() });
    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      layerId,
      status: 'PROCESSING',
      progress: 0,
    });

    const exportRecord = await deps.exportRepository.findById(exportId);
    if (!exportRecord) throw new Error(`Export ${exportId} not found`);

    const layer = await deps.layerRepository.findById(layerId);
    if (!layer) throw new Error(`Layer ${layerId} not found`);
    if (!layer.schemaName || !layer.tableName)
      throw new Error(`Layer ${layerId} has no spatial table`);

    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      layerId,
      status: 'PROCESSING',
      progress: 20,
    });

    const bbox = exportRecord.bbox as [number, number, number, number] | null;
    const featureIdNum = featureId && /^\d+$/.test(featureId) ? featureId : null;
    const s = layer.schemaName.replace(/\W/g, '');
    const t = layer.tableName.replace(/\W/g, '');
    await deps.ogr2ogrService.exportToFile({
      schema: layer.schemaName,
      table: layer.tableName,
      format: formatConfig.ogrFormat,
      outputPath,
      // Téléchargement d'une seule feature depuis la fiche descriptive : les
      // couches ciblées par ce bouton sont toujours des couches OSM-dérivées
      // (osm_id), cf. MapLayerService - rendu vectoriel réservé aux couches Point.
      sql: featureIdNum ? `SELECT * FROM "${s}"."${t}" WHERE osm_id = ${featureIdNum}` : undefined,
      bbox: featureIdNum ? undefined : (bbox ?? undefined),
    });

    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      layerId,
      status: 'PROCESSING',
      progress: 60,
    });

    // Un shapefile n'est valide qu'accompagné de ses fichiers .shx/.dbf/.prj -
    // on livre systématiquement un zip contenant l'ensemble, pas le .shp seul.
    let finalPath = outputPath;
    let finalFileName = outputFileName;
    if (format === 'SHAPEFILE') {
      const siblings = await findSiblingFiles(outputPath);
      cleanupPaths.push(...siblings);
      const zipPath = path.join(tmpDir, `export_${exportId}.zip`);
      await zipFiles(
        siblings.map((p) => ({ path: p, name: path.basename(p) })),
        zipPath,
      );
      cleanupPaths.push(zipPath);
      finalPath = zipPath;
      finalFileName = `export_${exportId}.zip`;
    }

    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      layerId,
      status: 'PROCESSING',
      progress: 70,
    });

    const fileBuffer = await readFile(finalPath);
    const fileStats = await stat(finalPath);
    const minioKey = `exports/${exportId}/${finalFileName}`;
    await deps.storageService.uploadFile(minioKey, fileBuffer);

    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      layerId,
      status: 'PROCESSING',
      progress: 90,
    });

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
    for (const p of cleanupPaths) {
      try {
        await unlink(p);
      } catch {
        /* ignore */
      }
    }
  }
}

async function processBulkExport(
  job: Job<LayerExportJobData>,
  deps: ExportWorkerDeps,
): Promise<void> {
  const { exportId, layerIds, userId, format } = job.data;
  logger.info('Processing bulk layer export', { exportId, layerIds, format });

  const tmpDir = process.env.DATA_DIR || '/tmp/geosm-data';
  await mkdir(tmpDir, { recursive: true });

  const formatConfig = FORMAT_TO_OGR[format] || FORMAT_TO_OGR.GEOPACKAGE;
  const zipFileName = `export_${exportId}.zip`;
  const zipPath = path.join(tmpDir, zipFileName);
  const layerOutputPaths: string[] = [];

  try {
    await deps.exportRepository.update(exportId, { status: 'PROCESSING', startedAt: new Date() });
    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      status: 'PROCESSING',
      progress: 0,
    });

    if (!layerIds || layerIds.length === 0) throw new Error('No layers provided for bulk export');

    const entries: Array<{ path: string; name: string }> = [];
    for (let i = 0; i < layerIds.length; i++) {
      const layerId = layerIds[i];
      const layer = await deps.layerRepository.findById(layerId);
      if (!layer || !layer.schemaName || !layer.tableName) {
        logger.warn('Skipping layer with no spatial table in bulk export', { exportId, layerId });
        continue;
      }
      // Layer.name est stocké en base sous forme de JSON i18n (ex. {"fr":"...","en":"..."}),
      // pas comme une chaîne d'affichage directe - on l'extrait pour un nom de fichier lisible.
      const displayName = extractDisplayName(layer.name) || layer.tableName;
      const safeName = displayName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const outputFileName = `${safeName}${formatConfig.ext}`;
      const outputPath = path.join(tmpDir, `${exportId}_${i}_${outputFileName}`);
      await deps.ogr2ogrService.exportToFile({
        schema: layer.schemaName,
        table: layer.tableName,
        format: formatConfig.ogrFormat,
        outputPath,
      });
      layerOutputPaths.push(outputPath);

      if (format === 'SHAPEFILE') {
        // Inclure tous les fichiers compagnons (.shx, .dbf, .prj...), pas que le .shp -
        // préfixés par safeName, donc pas de collision entre couches dans le zip final.
        const siblings = await findSiblingFiles(outputPath);
        layerOutputPaths.push(...siblings.filter((p) => p !== outputPath));
        entries.push(...siblings.map((p) => ({ path: p, name: path.basename(p) })));
      } else {
        entries.push({ path: outputPath, name: outputFileName });
      }

      const progress = 10 + Math.round(((i + 1) / layerIds.length) * 60);
      deps.notificationService.notifyUser(userId, 'export:progress', {
        exportId,
        status: 'PROCESSING',
        progress,
      });
    }

    if (entries.length === 0) throw new Error('No exportable layers found for bulk export');

    await zipFiles(entries, zipPath);
    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      status: 'PROCESSING',
      progress: 80,
    });

    const fileBuffer = await readFile(zipPath);
    const fileStats = await stat(zipPath);
    const minioKey = `exports/${exportId}/${zipFileName}`;
    await deps.storageService.uploadFile(minioKey, fileBuffer);

    deps.notificationService.notifyUser(userId, 'export:progress', {
      exportId,
      status: 'PROCESSING',
      progress: 95,
    });

    await deps.exportRepository.update(exportId, {
      status: 'COMPLETED',
      completedAt: new Date(),
      filePath: minioKey,
      fileSize: fileStats.size,
    });

    deps.notificationService.notifyUser(userId, 'export:completed', {
      exportId,
      status: 'COMPLETED',
      filePath: minioKey,
      fileSize: fileStats.size,
    });

    exportCompletedTotal.inc();
    logger.info('Bulk layer export completed', {
      exportId,
      layerCount: entries.length,
      fileSize: fileStats.size,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Bulk layer export failed', { exportId, error: errorMessage });

    await deps.exportRepository.update(exportId, {
      status: 'FAILED',
      errorMessage,
      completedAt: new Date(),
    });
    deps.notificationService.notifyUser(userId, 'export:failed', {
      exportId,
      status: 'FAILED',
      error: errorMessage,
    });

    throw error;
  } finally {
    for (const p of layerOutputPaths) {
      try {
        await unlink(p);
      } catch {
        /* ignore */
      }
    }
    try {
      await unlink(zipPath);
    } catch {
      /* ignore */
    }
  }
}
