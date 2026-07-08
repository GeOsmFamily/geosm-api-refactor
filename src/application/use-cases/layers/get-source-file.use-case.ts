import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { Ogr2OgrService } from '../../../infrastructure/gdal/ogr2ogr.service.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetSourceFileUseCase');

/**
 * Fournit un lien de téléchargement du fichier source d'une couche. La plupart des couches
 * (fichier importé, tag OSM, couches par défaut) n'ont jamais eu de fichier déposé dans MinIO -
 * seul l'ancien worker d'import asynchrone (layer-import.worker.ts) y écrivait un objet. Plutôt
 * que d'échouer (NoSuchKey) dans tous les autres cas, on exporte à la demande les données
 * actuelles de la table PostGIS de la couche en GeoJSON via ogr2ogr, on le dépose dans MinIO sous
 * la même clé (réutilisable/cache pour les téléchargements suivants), puis on signe une URL
 * exactement comme avant - le contrat de l'endpoint ({layerId, name, url}) ne change pas.
 */
export class GetSourceFileUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly storageService: MinioStorageService,
    private readonly ogr2ogrService: Ogr2OgrService,
  ) {}

  async execute(layerId: string) {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new Error('Layer not found');

    const objectName = `layers/${layerId}/source`;

    const exists = await this.storageService.fileExists(objectName);
    if (!exists) {
      if (!layer.schemaName || !layer.tableName) {
        throw new ValidationError(
          "Cette couche n'a pas de données PostGIS exploitables (source externe, ex. projet QGIS) : téléchargement impossible.",
          {},
        );
      }
      await this.exportAndUpload(layer.schemaName, layer.tableName, objectName);
    }

    const url = await this.storageService.getPresignedUrl(objectName);
    logger.info('Source file presigned URL generated', { layerId });
    return { layerId, name: layer.name, url };
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
      logger.info('Export GeoJSON généré à la demande et mis en cache dans MinIO', {
        schema,
        table,
        objectName,
      });
    } finally {
      await unlink(tmpPath).catch(() => undefined);
    }
  }
}
