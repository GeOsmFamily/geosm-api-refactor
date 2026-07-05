import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PrismaInstanceRepository } from '../../../infrastructure/database/repositories/prisma-instance.repository.js';
import { OsmQueryService, CreateOsmTableOptions } from '../../../infrastructure/database/osm-query.service.js';
import { defaultLayers } from '../../../domain/constants/default-layers.constants.js';
import { GeometryType } from '../../../domain/enums.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { logger } from '../../../infrastructure/observability/logger.js';

/**
 * Recharge une couche par défaut (dérivée d'OSM, voir CreateInstanceUseCase) depuis les
 * données OSM déjà importées en base (osm.planet_osm_*) - ne redéclenche PAS un nouveau
 * téléchargement/import OSM complet (voir scripts/import-srtm.sh et l'équivalent OSM pour
 * ça), seulement la reconstruction de la table dérivée de cette couche à partir de l'état
 * actuel des tables source. Utile après un ré-import manuel des données OSM brutes, ou pour
 * rafraîchir les statistiques (nombre de features, aire totale...) affichées à l'utilisateur.
 */
export class ResyncLayerUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: PrismaInstanceRepository,
    private readonly osmQueryService: OsmQueryService,
  ) {}

  async execute(layerId: string) {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);

    const instance = await this.instanceRepository.findById(layer.instanceId);
    if (!instance) throw new NotFoundError('Instance', layer.instanceId);

    // Une couche par défaut a un slug "{instanceSlug}-{layerConfig.slug}" (voir
    // CreateInstanceUseCase) - on retrouve sa définition (tags OSM, type de géométrie) dans
    // la même config statique que celle utilisée à la création de l'instance.
    const slugSuffix = layer.slug.startsWith(`${instance.slug}-`) ? layer.slug.slice(instance.slug.length + 1) : null;
    const layerConfig = slugSuffix ? defaultLayers.find((l) => l.slug === slugSuffix) : undefined;
    if (!layerConfig) {
      throw new ValidationError('Cette couche n\'est pas une couche par défaut dérivée d\'OSM : resynchronisation impossible.', { layerId });
    }
    if (!layer.tableName || !layer.schemaName) {
      throw new ValidationError('Couche sans table spatiale associée.', { layerId });
    }

    let sourceTable: 'planet_osm_point' | 'planet_osm_line' | 'planet_osm_polygon' = 'planet_osm_point';
    if (layerConfig.geometryType === GeometryType.POLYGON) {
      sourceTable = 'planet_osm_polygon';
    } else if (layerConfig.geometryType === GeometryType.LINESTRING) {
      sourceTable = 'planet_osm_line';
    }

    const conditions = layerConfig.tagsOsm.split(';').map((part) => {
      const [key, value] = part.split('=');
      return { key: key.trim(), value: (value ?? '*').trim() };
    });

    const osmOptions: CreateOsmTableOptions = {
      schema: layer.schemaName,
      table: layer.tableName,
      sourceTable,
      conditions,
    };

    if (instance.boundaryTable && instance.boundaryId != null) {
      osmOptions.boundaryTable = instance.boundaryTable;
      osmOptions.boundaryId = instance.boundaryId;
      osmOptions.boundaryGeomColumn = instance.boundaryGeomCol ?? 'geom';
    } else if (instance.bbox && (instance.bbox as number[]).length === 4) {
      osmOptions.bbox = instance.bbox as [number, number, number, number];
    }

    const stats = await this.osmQueryService.createTable(osmOptions);
    logger.info('Couche resynchronisée depuis les données OSM déjà importées', { layerId, tableName: layer.tableName, stats });

    const existingMetadata = (layer.metadata as Record<string, unknown> | null) ?? {};
    return this.layerRepository.update(layerId, {
      metadata: {
        ...existingMetadata,
        featureCount: stats.count,
        totalArea: stats.totalArea,
        totalLength: stats.totalLength,
        lastSyncedAt: new Date().toISOString(),
      },
    });
  }
}
