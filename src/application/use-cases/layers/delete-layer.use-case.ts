import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { RemoveLayerIndexUseCase } from '../search/remove-layer-index.use-case.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteLayerUseCase');

/**
 * Supprime une couche du catalogue : au-delà de la ligne Prisma, nettoie aussi ce qu'elle a
 * laissé derrière elle - table PostGIS dédiée (si la couche en a une) et son entrée dans le
 * projet QGIS de l'instance (sinon la couche continue d'apparaître, cassée, dans QGIS Desktop/
 * Server, et son id reste référencé dans WFSLayers - voir remove_layer.py, dont l'absence de
 * nettoyage a un jour cassé le rendu WMS de TOUTE une instance après plusieurs suppressions
 * manuelles). Chaque étape de nettoyage est non-bloquante : un échec ne doit jamais empêcher la
 * suppression elle-même de la ligne catalogue.
 */
export class DeleteLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly qgisProjectRepository: IQgisProjectRepository,
    private readonly qgisProjectService: QGISProjectService,
    private readonly postGISService: PostGISService,
    private readonly removeLayerIndexUseCase?: RemoveLayerIndexUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const layer = await this.layerRepository.findById(id);
    if (!layer) throw new NotFoundError('Layer', id);

    await this.layerRepository.delete(id);
    logger.info('Layer deleted', { layerId: id });

    if (layer.schemaName && layer.tableName) {
      try {
        await this.postGISService.dropSpatialTable(layer.schemaName, layer.tableName);
      } catch (error) {
        logger.warn('Failed to drop PostGIS table for deleted layer', {
          layerId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const wmsLayerName = layer.sourceLayer || layer.tableName;
    if (wmsLayerName) {
      try {
        const projectPath = await this.resolveProjectPath(layer);
        const result = await this.qgisProjectService.removeLayer(projectPath, wmsLayerName);
        if (!result.success) {
          logger.warn('Failed to remove layer from QGIS project', {
            layerId: id,
            error: result.error,
          });
        }
      } catch (error) {
        logger.warn('Exception while removing layer from QGIS project', {
          layerId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    try {
      await this.removeLayerIndexUseCase?.execute(id);
    } catch (error) {
      logger.warn('Failed to remove search index for deleted layer', {
        layerId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async resolveProjectPath(layer: Layer): Promise<string> {
    if (layer.qgisProjectId) {
      const project = await this.qgisProjectRepository.findById(layer.qgisProjectId);
      if (project) return project.filePath;
    }
    const instance = await this.instanceRepository.findById(layer.instanceId);
    if (!instance) throw new NotFoundError('Instance', layer.instanceId);
    return this.qgisProjectService.getProjectPath(instance.slug);
  }
}
