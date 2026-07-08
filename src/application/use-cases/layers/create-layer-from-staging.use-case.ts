import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { buildQgisPgUri } from '../../../infrastructure/qgis/pg-uri.util.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('CreateLayerFromStagingUseCase');

export interface CreateLayerFromStagingInput {
  stagingTable: string;
  name: string;
  description?: string;
  subGroupId: string;
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  isVisible?: boolean;
  isQueryable?: boolean;
}

const PG_GEOM_TO_DOMAIN: Record<string, GeometryType> = {
  POINT: GeometryType.POINT,
  MULTIPOINT: GeometryType.MULTIPOINT,
  LINESTRING: GeometryType.LINESTRING,
  MULTILINESTRING: GeometryType.MULTILINESTRING,
  POLYGON: GeometryType.POLYGON,
  MULTIPOLYGON: GeometryType.MULTIPOLYGON,
};

/**
 * Promeut une table de staging (créée par StageFileImportUseCase) en couche définitive : renomme
 * la table vers le schéma/table calculés depuis les slugs (instance + couche, même convention que
 * CreateInstanceUseCase), crée l'enregistrement Layer, puis enregistre la table comme couche du
 * projet QGIS de l'instance (WMS/WFS) - même mécanisme que les couches par défaut.
 */
export class CreateLayerFromStagingUseCase {
  constructor(
    private readonly layerRepository: ILayerRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly postGISService: PostGISService,
    private readonly qgisProjectService: QGISProjectService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(instanceId: string, input: CreateLayerFromStagingInput): Promise<Layer> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);

    const stagingExists = await this.postGISService.tableExists('staging', input.stagingTable);
    if (!stagingExists) {
      throw new ValidationError('Table de staging introuvable ou déjà promue.', {
        stagingTable: input.stagingTable,
      });
    }

    const slug = Slug.create(input.name);
    const existing = await this.layerRepository.findBySlug(slug.value, instanceId);
    if (existing) {
      throw new ConflictError('Layer with this slug already exists in this instance');
    }

    const finalSchema = instance.slug;
    const finalTable = `${instance.slug}_${slug.value}`.replace(/\W/g, '');

    const geomTypeRows = await this.prisma.$queryRawUnsafe<{ geometrytype: string | null }[]>(
      `SELECT GeometryType(geom) AS geometrytype FROM "staging"."${input.stagingTable}" WHERE geom IS NOT NULL LIMIT 1`,
    );
    const pgGeomType = geomTypeRows[0]?.geometrytype;
    const geometryType = pgGeomType ? PG_GEOM_TO_DOMAIN[pgGeomType] : undefined;
    if (!geometryType) {
      throw new ValidationError(
        'Impossible de déterminer le type de géométrie du fichier importé.',
        {},
      );
    }

    await this.postGISService.createSchema(finalSchema);
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "staging"."${input.stagingTable}" SET SCHEMA "${finalSchema}"`,
    );
    await this.prisma.$executeRawUnsafe(
      `ALTER TABLE "${finalSchema}"."${input.stagingTable}" RENAME TO "${finalTable}"`,
    );
    await this.prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "${finalTable}_geom_idx" ON "${finalSchema}"."${finalTable}" USING GIST(geom)`,
    );

    const projectPath = this.qgisProjectService.getProjectPath(instance.slug);
    const pgUri = buildQgisPgUri(finalSchema, finalTable, {
      keyColumn: 'id',
      geometryType: pgGeomType!,
    });

    try {
      const qgisResult = await this.qgisProjectService.addVectorLayer(
        projectPath,
        pgUri,
        finalTable,
      );
      if (!qgisResult.success) {
        logger.warn('QGIS addVectorLayer a échoué pour la couche importée', {
          finalTable,
          error: qgisResult.error,
        });
      }
    } catch (qErr) {
      logger.warn('Exception QGIS addVectorLayer pour la couche importée', {
        finalTable,
        error: String(qErr),
      });
    }

    const layer = await this.layerRepository.create({
      id: uuidv4(),
      name: input.name,
      slug: slug.value,
      description: input.description ?? null,
      geometryType,
      sourceType: SourceType.WMS,
      // URL publique (atteignable par le navigateur), pas l'URL interne Docker.
      sourceUrl: `${config.QGIS_PUBLIC_URL}?map=${projectPath}`,
      sourceLayer: finalTable,
      tableName: finalTable,
      schemaName: finalSchema,
      minZoom: input.minZoom ?? 0,
      maxZoom: input.maxZoom ?? 22,
      isVisible: input.isVisible ?? false,
      isQueryable: input.isQueryable ?? true,
      opacity: input.opacity ?? 1,
      order: 0,
      metadata: { importedAt: new Date().toISOString(), source: 'file' },
      subGroupId: input.subGroupId,
      instanceId,
      qgisProjectId: null,
    });

    logger.info('Couche créée depuis un import de fichier', {
      layerId: layer.id,
      finalSchema,
      finalTable,
    });
    return layer;
  }
}
