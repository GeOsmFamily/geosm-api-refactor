import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetBoundaryUseCase');

export interface BoundaryDetail {
  id: number;
  name: string;
  adminLevel: number | null;
  geojson: unknown;
}

/**
 * Détail d'une limite administrative (avec géométrie simplifiée) pour l'aperçu carte du
 * sélecteur admin - voir SearchBoundariesUseCase pour la recherche par nom qui précède cet appel.
 */
export class GetBoundaryUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    tableName: string,
    id: number,
    geomColumn = 'geom',
  ): Promise<BoundaryDetail | null> {
    const parts = tableName.split('.');
    const schema = (parts.length > 1 ? parts[0] : 'public').replace(/[^a-zA-Z0-9_]/g, '');
    const table = (parts.length > 1 ? parts[1] : parts[0]).replace(/[^a-zA-Z0-9_]/g, '');
    const column = geomColumn.replace(/[^a-zA-Z0-9_]/g, '') || 'geom';

    const results = await this.prisma.$queryRawUnsafe<BoundaryDetail[]>(
      `SELECT id, name, admin_level AS "adminLevel",
              ST_AsGeoJSON(ST_SimplifyPreserveTopology("${column}", 0.01))::json AS geojson
       FROM "${schema}"."${table}"
       WHERE id = $1`,
      id,
    );

    logger.debug('Fetched boundary detail', { tableName, id, found: results.length > 0 });
    return results[0] ?? null;
  }
}
