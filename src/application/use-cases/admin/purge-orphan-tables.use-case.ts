import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('PurgeOrphanTablesUseCase');

export interface PurgeOrphanTablesResult {
  /** Nombre de tables PostGIS effectivement supprimées. */
  purgedTablesCount: number;
  /** Noms qualifiés (schema.table) des tables supprimées. */
  purgedTables: string[];
}

/**
 * Supprime les tables PostGIS orphelines, c'est-à-dire les tables qui existent
 * dans la base (schémas public/instances/staging) mais dont le couple
 * (schemaName, tableName) n'est plus référencé dans aucune ligne de la table
 * `layers` ni de `personal_layers`.
 *
 * SÉCURITÉ :
 * - Seules les tables des schémas non-système sont candidates
 *   (exclut pg_catalog, information_schema, topology, tiger…).
 * - On exclut les tables Prisma/système (users, instances, groups, …) en ne
 *   retenant que celles dont le nom figure dans la colonne table_name des
 *   couches (layers + personal_layers).  Ainsi même si une table Prisma n'est
 *   pas référencée comme couche elle ne sera jamais supprimée.
 * - Chaque DROP TABLE est précédé d'un log avec le nom exact de la table.
 */
export class PurgeOrphanTablesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<PurgeOrphanTablesResult> {
    // 1. Récupérer tous les (schemaName, tableName) référencés dans layers
    const referencedFromLayers = await this.prisma.$queryRawUnsafe<
      { schema_name: string; table_name: string }[]
    >(
      `SELECT DISTINCT schema_name, table_name
       FROM layers
       WHERE schema_name IS NOT NULL AND table_name IS NOT NULL`,
    );

    // 2. Récupérer tous les (schemaName, tableName) référencés dans personal_layers
    const referencedFromPersonalLayers = await this.prisma.$queryRawUnsafe<
      { schema_name: string; table_name: string }[]
    >(
      `SELECT DISTINCT schema_name, table_name
       FROM personal_layers
       WHERE schema_name IS NOT NULL AND table_name IS NOT NULL`,
    );

    // 3. Construire l'ensemble de référence (clé: "schema.table")
    const referenced = new Set<string>();
    for (const r of [...referencedFromLayers, ...referencedFromPersonalLayers]) {
      referenced.add(`${r.schema_name}.${r.table_name}`);
    }

    // 4. Lister toutes les tables physiques dont le schéma est dans la liste
    //    des schémas pouvant contenir des données de couches.
    //    On exclut les schémas système PostgreSQL/PostGIS.
    const physicalTables = await this.prisma.$queryRawUnsafe<
      { schema_name: string; table_name: string }[]
    >(
      `SELECT table_schema AS schema_name, table_name
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN (
           'pg_catalog', 'information_schema', 'topology',
           'tiger', 'tiger_data', 'postgis'
         )
         -- N'inclure que les tables référencées au moins une fois dans les colonnes
         -- table_name de layers ou personal_layers (toute table Prisma propre
         -- est ainsi immunisée car elle n'apparaît jamais dans ces colonnes).
         AND table_name IN (
           SELECT DISTINCT table_name FROM layers   WHERE table_name IS NOT NULL
           UNION
           SELECT DISTINCT table_name FROM personal_layers WHERE table_name IS NOT NULL
         )`,
    );

    // 5. Identifier les tables physiques non référencées = orphelines
    const orphans = physicalTables.filter(
      (t) => !referenced.has(`${t.schema_name}.${t.table_name}`),
    );

    if (orphans.length === 0) {
      logger.info('PurgeOrphanTables: aucune table orpheline trouvée');
      return { purgedTablesCount: 0, purgedTables: [] };
    }

    const purgedTables: string[] = [];

    for (const orphan of orphans) {
      // Sécuriser les identifiants (pas de caractères spéciaux non alphanumériques)
      const safeSchema = orphan.schema_name.replace(/[^a-zA-Z0-9_]/g, '');
      const safeTable = orphan.table_name.replace(/[^a-zA-Z0-9_]/g, '');
      const qualifiedName = `"${safeSchema}"."${safeTable}"`;

      try {
        await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${qualifiedName} CASCADE`);
        purgedTables.push(`${safeSchema}.${safeTable}`);
        logger.warn('PurgeOrphanTables: table supprimée', { schema: safeSchema, table: safeTable });
      } catch (err) {
        // On log l'erreur mais on continue avec les autres tables
        logger.error('PurgeOrphanTables: échec DROP TABLE', {
          schema: safeSchema,
          table: safeTable,
          error: err,
        });
      }
    }

    logger.info('PurgeOrphanTables: purge terminée', { count: purgedTables.length, purgedTables });

    return {
      purgedTablesCount: purgedTables.length,
      purgedTables,
    };
  }
}
