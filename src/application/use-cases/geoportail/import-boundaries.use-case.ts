import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { Ogr2OgrService } from '../../../infrastructure/gdal/ogr2ogr.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ImportBoundariesUseCase');

export interface ImportBoundariesInput {
  filePath: string;
  /** Champ source (shapefile/GeoJSON) contenant le nom lisible de chaque limite (ex. "NAME_2"). */
  nameField: string;
  /** Niveau administratif appliqué à toutes les entités importées (un fichier = un niveau, comme les exports GADM par niveau). */
  adminLevel: number;
  /** 'replace' supprime d'abord les lignes existantes de ce même niveau avant d'importer ; 'append' ajoute sans rien supprimer. */
  mode: 'append' | 'replace';
}

export interface ImportBoundariesResult {
  importedCount: number;
}

/**
 * Importe un shapefile (.zip) ou GeoJSON dans la table de référence public.admin_boundaries
 * (voir schema.prisma - modèle @@ignore, gérée hors du cycle de vie Prisma). Réutilise
 * Ogr2OgrService.importFile() (déjà utilisé pour l'import de couches) pour convertir le fichier
 * source dans une table de staging temporaire (qui conserve les noms de colonnes d'origine),
 * puis fait correspondre le champ "nom" choisi par l'admin vers le schéma fixe de
 * admin_boundaries (id, name, admin_level, geom) avant de supprimer la table de staging.
 */
export class ImportBoundariesUseCase {
  constructor(
    private readonly ogr2ogrService: Ogr2OgrService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(input: ImportBoundariesInput): Promise<ImportBoundariesResult> {
    const nameField = this.sanitizeIdentifier(input.nameField);
    if (!nameField) throw new Error('Invalid nameField');

    const stagingTable = `admin_boundaries_staging_${randomUUID().replace(/-/g, '')}`;

    await this.ogr2ogrService.importFile(input.filePath, 'public', stagingTable, 4326);

    try {
      if (input.mode === 'replace') {
        await this.prisma.$executeRawUnsafe(
          `DELETE FROM public.admin_boundaries WHERE admin_level = $1`,
          input.adminLevel,
        );
      }

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO public.admin_boundaries (name, admin_level, geom)
         SELECT "${nameField}"::text, $1, ST_Multi(ST_MakeValid(geom))
         FROM "public"."${stagingTable}"
         WHERE geom IS NOT NULL`,
        input.adminLevel,
      );

      const [{ count }] = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
        `SELECT COUNT(*)::bigint AS count FROM "public"."${stagingTable}"`,
      );

      logger.info('Boundaries imported', {
        adminLevel: input.adminLevel,
        mode: input.mode,
        count: Number(count),
      });
      return { importedCount: Number(count) };
    } finally {
      await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "public"."${stagingTable}"`);
    }
  }

  private sanitizeIdentifier(value: string): string | null {
    return /^[a-zA-Z_]\w*$/.test(value) ? value : null;
  }
}
