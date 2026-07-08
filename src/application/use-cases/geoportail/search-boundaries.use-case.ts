import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SearchBoundariesUseCase');

export interface BoundarySearchResult {
  id: number;
  name: string;
  adminLevel: number | null;
}

/**
 * Recherche par nom dans une table de limites administratives (ex: "admin_boundaries", importée
 * manuellement hors de l'application - voir docs/deploiement.md) - utilisée par le sélecteur
 * admin lors de la configuration de Instance.boundaryTable/boundaryId (voir hasBoundary() sur
 * l'entité Instance). Ne renvoie pas la géométrie (payload léger pour une liste de résultats) -
 * voir GetBoundaryUseCase pour l'aperçu géométrique d'un résultat sélectionné.
 */
export class SearchBoundariesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(tableName: string, query?: string, limit = 20): Promise<BoundarySearchResult[]> {
    const { schema, table } = this.parseTableName(tableName);

    const results = query
      ? await this.prisma.$queryRawUnsafe<BoundarySearchResult[]>(
          `SELECT id, name, admin_level AS "adminLevel"
           FROM "${schema}"."${table}"
           WHERE name ILIKE $1
           ORDER BY name
           LIMIT $2`,
          `%${query}%`,
          limit,
        )
      : await this.prisma.$queryRawUnsafe<BoundarySearchResult[]>(
          `SELECT id, name, admin_level AS "adminLevel"
           FROM "${schema}"."${table}"
           ORDER BY name
           LIMIT $1`,
          limit,
        );

    logger.debug('Searched boundaries', { tableName, query, count: results.length });
    return results;
  }

  private parseTableName(tableName: string): { schema: string; table: string } {
    const parts = tableName.split('.');
    const schema = (parts.length > 1 ? parts[0] : 'public').replace(/[^a-zA-Z0-9_]/g, '');
    const table = (parts.length > 1 ? parts[1] : parts[0]).replace(/[^a-zA-Z0-9_]/g, '');
    return { schema, table };
  }
}
