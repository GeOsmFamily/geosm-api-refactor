import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import type { FindAdminBoundariesByLevelUseCase } from './find-admin-boundaries-by-level.use-case.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

const NUMERIC_PG_TYPES = new Set([
  'integer',
  'smallint',
  'bigint',
  'numeric',
  'decimal',
  'real',
  'double precision',
]);

export interface ChoroplethZone {
  zoneId: number;
  zoneName: string;
  geometry: unknown;
  value: number | null;
}

/**
 * Choroplèthe : agrège un attribut numérique d'une couche vectorielle par zone administrative
 * (voir plan "Choroplèthes + Carroyage" du 2026-08-06). Synchrone (contrairement à l'analyse
 * raster asynchrone) - une agrégation vectorielle GROUP BY sur quelques dizaines de zones est
 * nettement moins coûteuse qu'un clip raster, pas besoin de file BullMQ + polling ici.
 */
export class GetChoroplethStatsUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
    private readonly findAdminBoundariesByLevelUseCase: FindAdminBoundariesByLevelUseCase,
  ) {}

  async execute(
    layerId: string,
    attribute: string,
    adminLevel: number,
  ): Promise<ChoroplethZone[]> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new ValidationError(
        "Cette couche n'a pas de table interrogeable (donnée servie depuis un projet QGIS externe).",
        {},
      );
    }

    // L'attribut n'est jamais interpolé sans validation contre le schéma réel de la table -
    // sanitizeIdentifier() côté PostGISService protège l'injection SQL, mais pas contre un nom
    // de colonne inexistant ou non numérique (ex. essayer d'AVG() une colonne texte).
    const columns = await this.postGISService.getTableColumns(layer.schemaName, layer.tableName);
    const column = columns.find((c) => c.name === attribute);
    if (!column) {
      throw new ValidationError(`Attribut "${attribute}" introuvable sur cette couche.`, {});
    }
    if (!NUMERIC_PG_TYPES.has(column.type)) {
      throw new ValidationError(`Attribut "${attribute}" n'est pas numérique.`, {});
    }

    const zones = await this.findAdminBoundariesByLevelUseCase.execute(
      layer.instanceId,
      adminLevel,
    );
    if (zones.length === 0) return [];

    const stats = await this.postGISService.getVectorZonalStats(
      layer.schemaName,
      layer.tableName,
      attribute,
      zones.map((z) => ({ id: z.id, name: z.name, geojson: JSON.stringify(z.geojson) })),
    );
    const statsByZoneId = new Map(stats.map((s) => [s.zoneId, s]));

    return zones.map((z) => ({
      zoneId: z.id,
      zoneName: z.name,
      geometry: z.geojson,
      value: statsByZoneId.get(z.id)?.sum ?? null,
    }));
  }
}
