import { v4 as uuidv4 } from 'uuid';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateLayersFromQgisProjectUseCase');

export interface QgisLayerSelection {
  /** Nom de la couche tel qu'exposé par le WMS du projet (voir ListQgisProjectLayersUseCase). */
  layerName: string;
  displayName: string;
  geometryType: GeometryType;
}

export interface CreateLayersFromQgisProjectInput {
  qgisProjectId: string;
  subGroupId: string;
  layers: QgisLayerSelection[];
}

/**
 * Crée une couche GeOSM par couche sélectionnée dans un projet QGIS uploadé (source "Projet
 * QGIS" de l'assistant) : contrairement aux sources fichier/OSM, la donnée reste dans les
 * sources propres du projet uploadé (pas de table PostGIS gérée par GeOSM) - la couche pointe
 * simplement vers le WMS de ce projet, comme le ferait n'importe quelle couche WMS externe.
 */
export class CreateLayersFromQgisProjectUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly qgisProjectRepository: IQgisProjectRepository,
  ) {}

  async execute(instanceId: string, input: CreateLayersFromQgisProjectInput): Promise<Layer[]> {
    const project = await this.qgisProjectRepository.findById(input.qgisProjectId);
    if (!project) throw new NotFoundError('QgisProject', input.qgisProjectId);

    const sourceUrl = `${config.QGIS_SERVER_URL}?map=${project.filePath}`;
    const created: Layer[] = [];

    for (const selection of input.layers) {
      const slug = Slug.create(selection.displayName);
      const existing = await this.layerRepository.findBySlug(slug.value, instanceId);
      if (existing) {
        logger.warn('Couche ignorée (slug déjà utilisé dans l\'instance)', { slug: slug.value });
        continue;
      }

      const layer = await this.layerRepository.create({
        id: uuidv4(),
        name: selection.displayName,
        slug: slug.value,
        description: null,
        geometryType: selection.geometryType,
        sourceType: SourceType.WMS,
        sourceUrl,
        sourceLayer: selection.layerName,
        tableName: null,
        schemaName: null,
        minZoom: 0,
        maxZoom: 22,
        isVisible: false,
        isQueryable: true,
        opacity: 1,
        order: 0,
        metadata: { importedAt: new Date().toISOString(), source: 'qgis-project', qgisProjectId: project.id },
        subGroupId: input.subGroupId,
        instanceId,
        qgisProjectId: project.id,
      });
      created.push(layer);
    }

    logger.info('Couches créées depuis un projet QGIS', { qgisProjectId: project.id, count: created.length });
    return created;
  }
}
