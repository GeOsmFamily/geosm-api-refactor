import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { Ogr2OgrService } from '../../../infrastructure/gdal/ogr2ogr.service.js';
import { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('StageFileImportUseCase');

export interface StageFileImportResult {
  stagingTable: string;
  featureCount: number;
  geometryType: string;
  fields: string[];
  preview: { type: 'FeatureCollection'; features: unknown[] };
}

/**
 * Importe un fichier géospatial (GeoJSON/KML/GPKG/Shapefile zippé/autres formats GDAL) dans une
 * table de staging temporaire (schéma "staging"), sans encore savoir sous quel nom final la
 * couche sera publiée - permet à l'assistant admin d'afficher un aperçu avant confirmation
 * (voir CreateLayerFromStagingUseCase pour la promotion vers le schéma/table définitifs).
 * Nettoie au passage les tables de staging orphelines de plus de 24h (pas de job dédié : le
 * volume est faible, un nettoyage paresseux à chaque nouvel import suffit).
 */
export class StageFileImportUseCase {
  constructor(
    private readonly ogr2ogrService: Ogr2OgrService,
    private readonly postGISService: PostGISService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(filePath: string): Promise<StageFileImportResult> {
    await this.cleanupOrphanedTables();

    const stagingTable = `t${Date.now()}_${randomBytes(4).toString('hex')}`;
    await this.postGISService.createSchema('staging');

    try {
      const importResult = await this.ogr2ogrService.importFile(filePath, 'staging', stagingTable, 4326);
      if (importResult.featureCount === 0) {
        throw new ValidationError('Le fichier importé ne contient aucune entité géométrique exploitable.', {});
      }

      const columns = await this.postGISService.getTableColumns('staging', stagingTable);
      const fields = columns.map((c) => c.name).filter((n) => !['geom', 'id'].includes(n));

      const preview = await this.postGISService.queryFeatures({
        schema: 'staging',
        table: stagingTable,
        limit: 100,
      });

      logger.info('Fichier importé en staging', { stagingTable, featureCount: importResult.featureCount });
      return {
        stagingTable,
        featureCount: importResult.featureCount,
        geometryType: importResult.geometryType,
        fields,
        preview,
      };
    } catch (error) {
      await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "staging"."${stagingTable}"`);
      throw error;
    }
  }

  private async cleanupOrphanedTables(): Promise<void> {
    try {
      const rows = await this.prisma.$queryRawUnsafe<{ table_name: string }[]>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'staging'`,
      );
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      for (const { table_name: tableName } of rows) {
        const match = tableName.match(/^t(\d+)_/);
        if (match && Number(match[1]) < cutoff) {
          await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "staging"."${tableName}"`);
          logger.info('Table de staging orpheline supprimée', { tableName });
        }
      }
    } catch (error) {
      logger.warn('Échec du nettoyage des tables de staging', { error: String(error) });
    }
  }
}
