import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { GeometryType } from '../../../domain/enums.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ImportPersonalFileUseCase');

const PERSONAL_SCHEMA = 'personal_data';

const PG_GEOM_TO_DOMAIN: Record<string, GeometryType> = {
  POINT: GeometryType.POINT,
  MULTIPOINT: GeometryType.MULTIPOINT,
  LINESTRING: GeometryType.LINESTRING,
  MULTILINESTRING: GeometryType.MULTILINESTRING,
  POLYGON: GeometryType.POLYGON,
  MULTIPOLYGON: GeometryType.MULTIPOLYGON,
};

export interface ImportPersonalFileInput {
  userId: string;
  instanceId: string;
  stagingTable: string;
  name: string;
  description?: string;
  groupName: string;
  subGroupName: string;
  style?: { color?: string; iconKey?: string; shape?: string };
}

/**
 * Promeut une table de staging (StageFileImportUseCase, même pipeline que le catalogue admin)
 * en donnée PERSONNELLE et privée : contrairement à CreateLayerFromStagingUseCase, la table est
 * déplacée dans un schéma "personal_data" dédié (jamais le schéma de l'instance) et n'est
 * JAMAIS enregistrée dans le projet QGIS partagé de l'instance - aucune trace WMS publique,
 * rendu exclusivement côté client via GetPersonalLayerFeaturesUseCase. Le nom de table utilise
 * l'id de la PersonalLayer (pas le nom choisi par l'utilisateur) pour ne jamais entrer en
 * collision entre deux utilisateurs.
 */
export class ImportPersonalFileUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly postGISService: PostGISService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(input: ImportPersonalFileInput): Promise<PersonalLayerRecord> {
    const stagingExists = await this.postGISService.tableExists('staging', input.stagingTable);
    if (!stagingExists) {
      throw new ValidationError('Table de staging introuvable ou déjà promue.', {
        stagingTable: input.stagingTable,
      });
    }

    const geomTypeRows = await this.prisma.$queryRawUnsafe<{ geometrytype: string | null }[]>(
      `SELECT GeometryType(geom) AS geometrytype FROM "staging"."${input.stagingTable}" WHERE geom IS NOT NULL LIMIT 1`,
    );
    const pgGeomType = geomTypeRows[0]?.geometrytype;
    const geometryType = pgGeomType ? PG_GEOM_TO_DOMAIN[pgGeomType] : null;
    if (!geometryType) {
      throw new ValidationError(
        'Impossible de déterminer le type de géométrie du fichier importé.',
        {},
      );
    }

    const id = uuidv4();
    const finalTable = `pl_${id.replace(/-/g, '')}`;

    await this.postGISService.createSchema(PERSONAL_SCHEMA);
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "staging"."${input.stagingTable}" SET SCHEMA "${PERSONAL_SCHEMA}"`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "${PERSONAL_SCHEMA}"."${input.stagingTable}" RENAME TO "${finalTable}"`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${finalTable}_geom_idx" ON "${PERSONAL_SCHEMA}"."${finalTable}" USING GIST(geom)`,
    );

    const record = await this.personalLayerRepository.create({
      id,
      userId: input.userId,
      instanceId: input.instanceId,
      name: input.name,
      description: input.description ?? null,
      groupName: input.groupName,
      subGroupName: input.subGroupName,
      geometryType,
      sourceType: 'FILE',
      schemaName: PERSONAL_SCHEMA,
      tableName: finalTable,
      style: input.style ?? undefined,
    });

    logger.info('Donnée personnelle importée depuis un fichier', {
      personalLayerId: id,
      userId: input.userId,
      finalTable,
    });
    return record;
  }
}
