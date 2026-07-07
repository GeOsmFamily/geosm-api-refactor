import { config } from '../../config/env.config.js';

/**
 * Construit l'URI de connexion PostgreSQL natif compatible avec le provider QGIS
 * (voir CreateInstanceUseCase pour l'usage historique de ce format, ici factorisé pour être
 * réutilisé par les nouveaux chemins d'import de couche - fichier et OSM).
 */
export function buildQgisPgUri(
  schema: string,
  table: string,
  options: { keyColumn: string; geometryType: string; srid?: number },
): string {
  const dbUrl = new URL(config.DATABASE_URL);
  return [
    `dbname='${dbUrl.pathname.replace('/', '')}'`,
    `host='${dbUrl.hostname}'`,
    `port='${dbUrl.port || '5432'}'`,
    `user='${dbUrl.username}'`,
    `password='${dbUrl.password}'`,
    `sslmode=disable`,
    `key='${options.keyColumn}'`,
    `srid=${options.srid ?? 4326}`,
    `type=${options.geometryType}`,
    `table="${schema}"."${table}"`,
    `(geom)`,
  ].join(' ');
}
