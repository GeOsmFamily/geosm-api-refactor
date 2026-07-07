import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const execAsync = promisify(exec);
const logger = createChildLogger('ExportQgisProjectBundleUseCase');

export interface ExportQgisProjectBundleResult {
  name: string;
  url: string;
  convertedLayerCount: number;
  totalLayerCount: number;
}

/**
 * Empaquette un projet QGIS complet (projet + toutes les couches + leur donnée actuelle + leurs
 * styles) en une seule archive .zip téléchargeable et directement ouvrable dans QGIS Desktop -
 * contrairement au projet "live" servi par QGIS Server, ce paquet ne dépend plus de la base
 * PostGIS de GeOSM (voir export_offline_bundle.py, basé sur QgsOfflineEditing).
 */
export class ExportQgisProjectBundleUseCase {
  constructor(
    private readonly qgisProjectRepository: IQgisProjectRepository,
    private readonly qgisProjectService: QGISProjectService,
    private readonly storageService: MinioStorageService,
  ) {}

  async execute(qgisProjectId: string): Promise<ExportQgisProjectBundleResult> {
    const project = await this.qgisProjectRepository.findById(qgisProjectId);
    if (!project) throw new NotFoundError('QgisProject', qgisProjectId);

    const exportId = randomUUID();
    const outputDir = path.join(config.DATA_DIR, `qgis-bundle-${exportId}`);
    const zipPath = path.join(config.DATA_DIR, `qgis-bundle-${exportId}.zip`);

    try {
      const result = await this.qgisProjectService.exportOfflineBundle(project.filePath, outputDir);
      if (!result.success) {
        throw new ValidationError(`Échec de l'export du projet QGIS: ${result.error}`, {});
      }

      // Zip le contenu du dossier (pas le dossier lui-même) pour que project.qgs et data.gpkg
      // se retrouvent à la racine de l'archive - QGIS s'attend à les trouver côte à côte.
      await execAsync(`cd "${outputDir}" && zip -r "${zipPath}" .`);

      const buffer = await readFile(zipPath);
      const objectName = `qgis-exports/${exportId}.zip`;
      await this.storageService.uploadFile(objectName, buffer, 'application/zip', buffer.length);
      const url = await this.storageService.getPresignedUrl(objectName);

      logger.info('Projet QGIS empaqueté et déposé', {
        qgisProjectId,
        convertedLayerCount: result.convertedLayerCount,
        totalLayerCount: result.totalLayerCount,
      });

      return {
        name: `${project.name}.zip`,
        url,
        convertedLayerCount: Number(result.convertedLayerCount) || 0,
        totalLayerCount: Number(result.totalLayerCount) || 0,
      };
    } finally {
      await rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
      await rm(zipPath, { force: true }).catch(() => undefined);
    }
  }
}
