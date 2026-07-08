import { v4 as uuidv4 } from 'uuid';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import {
  OsmQueryService,
  OsmKeyValue,
  CreateOsmTableOptions,
} from '../../../infrastructure/database/osm-query.service.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { buildQgisPgUri } from '../../../infrastructure/qgis/pg-uri.util.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateLayerFromOsmUseCase');

export interface CreateLayerFromOsmInput {
  name: string;
  description?: string;
  subGroupId: string;
  geometryType: GeometryType;
  conditions: OsmKeyValue[];
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
}

const DOMAIN_TO_SOURCE_TABLE: Record<GeometryType, CreateOsmTableOptions['sourceTable']> = {
  [GeometryType.POINT]: 'planet_osm_point',
  [GeometryType.MULTIPOINT]: 'planet_osm_point',
  [GeometryType.LINESTRING]: 'planet_osm_line',
  [GeometryType.MULTILINESTRING]: 'planet_osm_line',
  [GeometryType.POLYGON]: 'planet_osm_polygon',
  [GeometryType.MULTIPOLYGON]: 'planet_osm_polygon',
};

const DOMAIN_TO_QGIS_TYPE: Record<GeometryType, string> = {
  [GeometryType.POINT]: 'POINT',
  [GeometryType.MULTIPOINT]: 'MULTIPOINT',
  [GeometryType.LINESTRING]: 'LINESTRING',
  [GeometryType.MULTILINESTRING]: 'MULTILINESTRING',
  [GeometryType.POLYGON]: 'MULTIPOLYGON',
  [GeometryType.MULTIPOLYGON]: 'MULTIPOLYGON',
};

/**
 * Crée une couche filtrée par tag OSM (source "Données OSM" de l'assistant admin) : contrairement
 * à l'import de fichier, aucune table de staging n'est nécessaire - le nom final (schéma/table)
 * est calculé directement depuis les slugs instance+couche, puis OsmQueryService.createTable()
 * (déjà utilisé par ResyncLayerUseCase/CreateInstanceUseCase) construit la table en un seul appel,
 * scopée sur la limite administrative de l'instance si elle en a une.
 */
export class CreateLayerFromOsmUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly osmQueryService: OsmQueryService,
    private readonly qgisProjectService: QGISProjectService,
  ) {}

  async execute(instanceId: string, input: CreateLayerFromOsmInput): Promise<Layer> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const slug = Slug.create(input.name);
    const existing = await this.layerRepository.findBySlug(slug.value, instanceId);
    if (existing) {
      throw new ConflictError('Layer with this slug already exists in this instance');
    }

    const finalSchema = instance.slug;
    const finalTable = `${instance.slug}_${slug.value}`.replace(/\W/g, '');

    const osmOptions: CreateOsmTableOptions = {
      schema: finalSchema,
      table: finalTable,
      sourceTable: DOMAIN_TO_SOURCE_TABLE[input.geometryType],
      conditions: input.conditions,
    };
    if (instance.boundaryTable && instance.boundaryId != null) {
      osmOptions.boundaryTable = instance.boundaryTable;
      osmOptions.boundaryId = instance.boundaryId;
      osmOptions.boundaryGeomColumn = instance.boundaryGeomCol ?? 'geom';
    } else if (instance.bbox && instance.bbox.length === 4) {
      osmOptions.bbox = instance.bbox as [number, number, number, number];
    }

    const stats = await this.osmQueryService.createTable(osmOptions);

    const projectPath = this.qgisProjectService.getProjectPath(instance.slug);
    const pgUri = buildQgisPgUri(finalSchema, finalTable, {
      keyColumn: 'osm_id',
      geometryType: DOMAIN_TO_QGIS_TYPE[input.geometryType],
    });

    try {
      const qgisResult = await this.qgisProjectService.addVectorLayer(
        projectPath,
        pgUri,
        finalTable,
      );
      if (!qgisResult.success) {
        logger.warn('QGIS addVectorLayer a échoué pour la couche OSM', {
          finalTable,
          error: qgisResult.error,
        });
      }
    } catch (qErr) {
      logger.warn('Exception QGIS addVectorLayer pour la couche OSM', {
        finalTable,
        error: String(qErr),
      });
    }

    const layer = await this.layerRepository.create({
      id: uuidv4(),
      name: input.name,
      slug: slug.value,
      description: input.description ?? null,
      geometryType: input.geometryType,
      sourceType: SourceType.WMS,
      sourceUrl: `${config.QGIS_SERVER_URL}?map=${projectPath}`,
      sourceLayer: finalTable,
      tableName: finalTable,
      schemaName: finalSchema,
      minZoom: input.minZoom ?? 0,
      maxZoom: input.maxZoom ?? 22,
      isVisible: input.isVisible ?? false,
      isQueryable: input.isQueryable ?? true,
      opacity: input.opacity ?? 1,
      order: 0,
      metadata: {
        importedAt: new Date().toISOString(),
        source: 'osm',
        tagsOsm: input.conditions.map((c) => `${c.key}=${c.value}`).join(';'),
        featureCount: stats.count,
        totalArea: stats.totalArea,
        totalLength: stats.totalLength,
      },
      subGroupId: input.subGroupId,
      instanceId,
      qgisProjectId: null,
    });

    logger.info('Couche créée depuis un tag OSM', { layerId: layer.id, finalSchema, finalTable });
    return layer;
  }
}
