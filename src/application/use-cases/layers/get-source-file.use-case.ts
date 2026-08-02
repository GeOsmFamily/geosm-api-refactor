import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { Ogr2OgrService } from '../../../infrastructure/gdal/ogr2ogr.service.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetSourceFileUseCase');

export interface SourceFileResult {
  layerId: string;
  name: string;
  /** Stream du contenu GeoJSON à envoyer directement au client. */
  stream: Readable;
  /** Taille en octets si connue (pour le Content-Length header). */
  sizeBytes?: number;
}

/**
 * Fournit le contenu GeoJSON d'une couche sous forme de stream.
 *
 * Stratégie :
 * 1. Si un fichier source existe déjà dans MinIO pour cette couche, on le
 *    stream directement depuis MinIO → le client.
 * 2. Sinon, on exporte les données PostGIS actuelles en GeoJSON via ogr2ogr,
 *    on l'uploade dans MinIO pour le mettre en cache, puis on le stream.
 * 3. Pour les couches sans table PostGIS (WMS/WFS externes, QGIS), une erreur
 *    de validation explicite est levée.
 *
 * Pourquoi ne plus renvoyer une URL pré-signée MinIO ?
 * - L'endpoint MinIO (MINIO_ENDPOINT) est un nom de service Docker interne,
 *   injoignable depuis le navigateur.
 * - MINIO_PUBLIC_ENDPOINT permet de signer avec un hôte public mais cela
 *   crée une dépendance fragile sur la topologie réseau (ports, SSL, proxy).
 * - En streamant via l'API (même domaine/port que le reste), le navigateur
 *   n'a aucune contrainte réseau supplémentaire et le JWT Bearer token protège
 *   toujours l'accès.
 */
export class GetSourceFileUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly storageService: MinioStorageService,
    private readonly ogr2ogrService: Ogr2OgrService,
  ) {}

  async execute(layerId: string): Promise<SourceFileResult> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new Error('Layer not found');

    const objectName = `layers/${layerId}/source`;

    const exists = await this.storageService.fileExists(objectName);
    if (!exists) {
      if (!layer.schemaName || !layer.tableName) {
        throw new ValidationError(
          "Cette couche n'a pas de données PostGIS exploitables (source externe : WMS, WFS, projet QGIS...). Le téléchargement GeoJSON n'est disponible que pour les couches importées ou créées depuis OSM.",
          {},
        );
      }
      await this.exportAndUpload(layer.schemaName, layer.tableName, objectName);
    }

    const stream = await this.storageService.downloadFile(objectName);
    const fileInfo = await this.storageService.getFileInfo(objectName).catch(() => undefined);

    logger.info('Source file stream opened', { layerId, objectName });

    return {
      layerId,
      name: layer.name,
      stream,
      sizeBytes: fileInfo?.size,
    };
  }

  private async exportAndUpload(schema: string, table: string, objectName: string): Promise<void> {
    const tmpPath = path.join(config.DATA_DIR, `layer-export-${randomUUID()}.geojson`);
    try {
      await this.ogr2ogrService.exportToFile({
        schema,
        table,
        format: 'GeoJSON',
        outputPath: tmpPath,
      });
      const buffer = await readFile(tmpPath);
      await this.storageService.uploadFile(
        objectName,
        buffer,
        'application/geo+json',
        buffer.length,
      );
      logger.info('Export GeoJSON genere a la demande et mis en cache dans MinIO', {
        schema,
        table,
        objectName,
      });
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  }
}
