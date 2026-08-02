import { PrismaClient } from '@prisma/client';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteInstanceUseCase');

/**
 * Supprime une instance et TOUTES ses données :
 * 1. Récupère la liste des tables PostGIS physiques des couches appartenant
 *    à cette instance avant de les supprimer de la base Prisma.
 * 2. Supprime l'enregistrement Prisma (cascades DB éliminent groups,
 *    sub_groups, layers, instance_users, personal_layers…).
 * 3. Supprime physiquement chaque table PostGIS récupérée à l'étape 1.
 *
 * SÉCURITÉ : seules les tables dont le couple (schemaName, tableName) était
 * référencé dans les couches de CETTE instance sont supprimées — les tables
 * d'autres instances ne sont jamais touchées.
 */
export class DeleteInstanceUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(id: string): Promise<void> {
    const instance = await this.instanceRepository.findById(id);
    if (!instance) throw new NotFoundError('Instance', id);

    // 1. Collecter les tables physiques AVANT la suppression en cascade
    const layerTables = await this.prisma.$queryRawUnsafe<
      { schema_name: string; table_name: string }[]
    >(
      `SELECT DISTINCT l.schema_name, l.table_name
       FROM layers l
       WHERE l.instance_id = $1::uuid
         AND l.schema_name IS NOT NULL
         AND l.table_name IS NOT NULL`,
      id,
    );

    const personalLayerTables = await this.prisma.$queryRawUnsafe<
      { schema_name: string; table_name: string }[]
    >(
      `SELECT DISTINCT pl.schema_name, pl.table_name
       FROM personal_layers pl
       WHERE pl.instance_id = $1::uuid
         AND pl.schema_name IS NOT NULL
         AND pl.table_name IS NOT NULL`,
      id,
    );

    const tablesToDrop = [...layerTables, ...personalLayerTables];

    // 2. Supprimer l'instance (cascade Prisma supprime layers, groups, users…)
    await this.instanceRepository.delete(id);
    logger.warn('Instance supprimée (Prisma)', { instanceId: id, name: instance.name });

    // 3. Supprimer physiquement chaque table PostGIS de l'instance
    for (const t of tablesToDrop) {
      const safeSchema = t.schema_name.replace(/[^a-zA-Z0-9_]/g, '');
      const safeTable = t.table_name.replace(/[^a-zA-Z0-9_]/g, '');
      const qualifiedName = `"${safeSchema}"."${safeTable}"`;

      try {
        await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${qualifiedName} CASCADE`);
        logger.warn('Table PostGIS supprimee avec instance', {
          instanceId: id,
          schema: safeSchema,
          table: safeTable,
        });
      } catch (err) {
        logger.error('Echec DROP TABLE lors de la suppression instance', {
          instanceId: id,
          schema: safeSchema,
          table: safeTable,
          error: err,
        });
      }
    }

    logger.info('Suppression instance complète', {
      instanceId: id,
      name: instance.name,
      tablesDropped: tablesToDrop.length,
    });
  }
}
