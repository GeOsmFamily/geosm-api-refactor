import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetDatabaseOverviewUseCase');

export interface TableInfo {
  schema: string;
  table: string;
  sizeBytes: number;
  sizePretty: string;
  rowEstimate: number;
}

export interface DatabaseOverview {
  totalSizeBytes: number;
  totalSizePretty: string;
  tableCount: number;
  tables: TableInfo[];
}

/**
 * Lot A9 (extension) admin - vue d'ensemble de la base pour le management : taille totale,
 * liste des tables (tous schémas confondus - osm/staging/instances/public) triée par taille
 * décroissante, avec estimation du nombre de lignes (n_live_tup, comme "\dt+" dans psql -
 * un COUNT(*) exact serait bien plus lent sur des tables de plusieurs millions de lignes comme
 * osm.planet_osm_point).
 */
export class GetDatabaseOverviewUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<DatabaseOverview> {
    const [totalSizeRows, tableRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ size_bytes: bigint; size_pretty: string }[]>(
        `SELECT pg_database_size(current_database()) AS size_bytes, pg_size_pretty(pg_database_size(current_database())) AS size_pretty`,
      ),
      this.prisma.$queryRawUnsafe<
        {
          schemaname: string;
          relname: string;
          size_bytes: bigint;
          size_pretty: string;
          row_estimate: bigint;
        }[]
      >(
        `SELECT schemaname, relname,
                pg_total_relation_size(relid) AS size_bytes,
                pg_size_pretty(pg_total_relation_size(relid)) AS size_pretty,
                n_live_tup AS row_estimate
         FROM pg_stat_user_tables
         ORDER BY pg_total_relation_size(relid) DESC`,
      ),
    ]);

    const tables: TableInfo[] = tableRows.map((r) => ({
      schema: r.schemaname,
      table: r.relname,
      sizeBytes: Number(r.size_bytes),
      sizePretty: r.size_pretty,
      rowEstimate: Number(r.row_estimate),
    }));

    logger.debug('Database overview retrieved', { tableCount: tables.length });

    return {
      totalSizeBytes: Number(totalSizeRows[0]?.size_bytes ?? 0),
      totalSizePretty: totalSizeRows[0]?.size_pretty ?? '0 bytes',
      tableCount: tables.length,
      tables,
    };
  }
}
