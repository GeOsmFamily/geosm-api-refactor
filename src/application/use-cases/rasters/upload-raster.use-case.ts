import { createReadStream } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { RasterService } from '../../../infrastructure/gdal/raster.service.js';
import { MinioStorageService } from '../../../infrastructure/storage/minio.service.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UploadRasterUseCase');

export interface UploadRasterInput {
  filePath: string;
  tableName: string;
  instanceId: string;
  subGroupId: string;
  name: string;
  description?: string;
  srid?: number;
}

export interface UploadRasterResult {
  layer: Layer;
  tableName: string;
  postgisImportWarning: string | null;
}

/**
 * Importe un raster (gdalwarp + overviews + raster2pgsql) ET le rend réellement visible sur le
 * geoportail : contrairement à la version précédente qui s'arrêtait après l'import PostGIS (le
 * raster restait orphelin - RasterService.addToWMS() existait mais n'était jamais appelée), on
 * enregistre maintenant le GeoTIFF reprojeté comme couche du projet QGIS de l'instance
 * (add_raster_layer.py, réutilisé tel quel - QgsRasterLayer attend un chemin de fichier, pas une
 * connexion PostGIS, donc le fichier warped suffit) puis on crée un vrai enregistrement Layer
 * (sourceType=WMS) pour qu'il apparaisse dans le catalogue comme n'importe quelle autre couche.
 */
export class UploadRasterUseCase {
  constructor(
    private readonly rasterService: RasterService,
    private readonly storageService: MinioStorageService,
    private readonly qgisProjectService: QGISProjectService,
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
  ) {}

  async execute(input: UploadRasterInput): Promise<UploadRasterResult> {
    const instance = await this.instanceRepository.findById(input.instanceId);
    if (!instance) throw new NotFoundError('Instance', input.instanceId);

    const slug = Slug.create(input.name);
    const existing = await this.layerRepository.findBySlug(slug.value, input.instanceId);
    if (existing) {
      throw new ConflictError('Layer with this slug already exists in this instance');
    }

    logger.info('Importing raster', { tableName: input.tableName, srid: input.srid });
    const importResult = await this.rasterService.importRaster(input.filePath, input.tableName, {
      srid: input.srid,
    });
    logger.info('Raster imported', {
      tableName: importResult.tableName,
      postgisWarning: importResult.postgisWarning,
    });

    // Archivage MinIO best-effort, indépendant du reste du flux (une panne de stockage
    // d'archive ne doit pas empêcher le raster de devenir visible sur le portail).
    try {
      const stream = createReadStream(importResult.outputPath);
      await this.storageService.uploadFile(
        `rasters/${importResult.tableName}.tif`,
        stream,
        'image/tiff',
      );
    } catch (err) {
      logger.error('Raster archival to storage failed', {
        tableName: importResult.tableName,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const finalTable = `${instance.slug}_${slug.value}`.replace(/\W/g, '');
    const projectPath = this.qgisProjectService.getProjectPath(instance.slug);
    const qgisResult = await this.qgisProjectService.addRasterLayer(
      projectPath,
      importResult.outputPath,
      finalTable,
    );
    if (!qgisResult.success) {
      logger.warn('addRasterLayer a échoué - le raster reste importé mais non servi en WMS', {
        finalTable,
        error: qgisResult.error,
      });
    }

    const layer = await this.layerRepository.create({
      id: uuidv4(),
      name: input.name,
      slug: slug.value,
      description: input.description ?? null,
      geometryType: GeometryType.POLYGON,
      sourceType: SourceType.WMS,
      sourceUrl: `${config.QGIS_SERVER_URL}?map=${projectPath}`,
      sourceLayer: finalTable,
      tableName: importResult.tableName,
      schemaName: 'public',
      minZoom: 0,
      maxZoom: 22,
      isVisible: false,
      isQueryable: false,
      opacity: 1,
      order: 0,
      metadata: {
        importedAt: new Date().toISOString(),
        source: 'raster',
        rasterInfo: importResult.info,
      },
      subGroupId: input.subGroupId,
      instanceId: input.instanceId,
      qgisProjectId: null,
    });

    return {
      layer,
      tableName: importResult.tableName,
      postgisImportWarning: importResult.postgisWarning,
    };
  }
}
