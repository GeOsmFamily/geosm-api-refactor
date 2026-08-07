import type { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import type { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface GridCell {
  geometry: unknown;
  value: number;
}

const MIN_CELL_SIZE_METERS = 10;
const MAX_CELL_SIZE_METERS = 100000;

/**
 * Carroyage/hexbin : compte les entités d'une couche vectorielle par cellule d'une grille
 * générée sur l'emprise donnée (voir plan "Choroplèthes + Carroyage" du 2026-08-06,
 * ST_SquareGrid/ST_HexagonGrid, PostGIS 3.4+ - jamais utilisées ailleurs dans le code).
 * Synchrone comme GetChoroplethStatsUseCase - la grille est plafonnée à 2000 cellules côté
 * PostGISService, largement dans le budget d'une requête HTTP normale.
 */
export class GetGridStatsUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly postGISService: PostGISService,
  ) {}

  async execute(
    layerId: string,
    extent: [number, number, number, number],
    cellSizeMeters: number,
    gridType: 'square' | 'hexagon',
  ): Promise<GridCell[]> {
    const layer = await this.layerRepository.findById(layerId);
    if (!layer) throw new NotFoundError('Layer', layerId);
    if (!layer.schemaName || !layer.tableName) {
      throw new ValidationError(
        "Cette couche n'a pas de table interrogeable (donnée servie depuis un projet QGIS externe).",
        {},
      );
    }
    if (cellSizeMeters < MIN_CELL_SIZE_METERS || cellSizeMeters > MAX_CELL_SIZE_METERS) {
      throw new ValidationError(
        `La taille de maille doit être comprise entre ${MIN_CELL_SIZE_METERS} et ${MAX_CELL_SIZE_METERS} mètres.`,
        {},
      );
    }

    const rows = await this.postGISService.getGridStats(
      layer.schemaName,
      layer.tableName,
      extent,
      cellSizeMeters,
      gridType,
    );
    return rows.map((r) => ({ geometry: JSON.parse(r.geojson) as unknown, value: r.value }));
  }
}
