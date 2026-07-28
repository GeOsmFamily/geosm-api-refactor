import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';
import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { ILayerRepository } from '../../../domain/repositories/layer.repository.js';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { PostGISService } from '../../../infrastructure/database/postgis.service.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { buildQgisPgUri } from '../../../infrastructure/qgis/pg-uri.util.js';
import { GeometryType, SourceType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ReviewPersonalLayerPublicationUseCase');

export interface ReviewPersonalLayerPublicationInput {
  reviewerId: string;
  personalLayerId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
  overrideName?: string;
  overrideGroupName?: string;
  overrideSubGroupName?: string;
}

/**
 * Valide ou refuse une demande de publication. Sur validation : résout/crée le Group+SubGroup
 * cible (même logique de find-or-create que AutoImportQgisProjectUseCase), puis, selon la source :
 *  - FILE : promeut la table "personal_data"."pl_<uuid>" vers le schéma catalogue de l'instance
 *    (même séquence ALTER TABLE SET SCHEMA / RENAME / CREATE INDEX que
 *    CreateLayerFromStagingUseCase, source "personal_data" au lieu de "staging").
 *  - QGIS_PROJECT : aucune donnée à déplacer, la couche catalogue pointe directement sur le WMS du
 *    projet QGIS personnel déjà existant (même construction sourceUrl que
 *    CreateLayersFromQgisProjectUseCase).
 * L'admin peut surcharger nom/thématique/sous-thématique avant publication - ces overrides sont
 * aussi persistés sur la PersonalLayer d'origine pour que l'historique reflète le nom final publié.
 */
export class ReviewPersonalLayerPublicationUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly layerRepository: ILayerRepository,
    private readonly groupRepository: IGroupRepository,
    private readonly subGroupRepository: ISubGroupRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly postGISService: PostGISService,
    private readonly qgisProjectService: QGISProjectService,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(input: ReviewPersonalLayerPublicationInput): Promise<PersonalLayerRecord> {
    const layer = await this.personalLayerRepository.findById(input.personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', input.personalLayerId);
    if (layer.status !== 'PENDING_PUBLICATION') {
      throw new ValidationError("Cette donnée n'est pas en attente de validation.", {});
    }

    if (input.decision === 'REJECT') {
      const rejected = await this.personalLayerRepository.updateStatus(input.personalLayerId, {
        status: 'REJECTED',
        reviewedBy: input.reviewerId,
        reviewNote: input.reviewNote ?? null,
      });
      logger.info('Publication refusée', { personalLayerId: input.personalLayerId });
      return rejected;
    }

    const instance = await this.instanceRepository.findById(layer.instanceId);
    if (!instance) throw new NotFoundError('Instance', layer.instanceId);

    const finalName = input.overrideName ?? layer.name;
    const finalGroupName = input.overrideGroupName ?? layer.groupName;
    const finalSubGroupName = input.overrideSubGroupName ?? layer.subGroupName;

    const groupSlug = Slug.create(finalGroupName).value;
    let group = await this.groupRepository.findBySlug(groupSlug, layer.instanceId);
    if (!group) {
      group = await this.groupRepository.create({
        id: uuidv4(),
        instanceId: layer.instanceId,
        name: finalGroupName,
        slug: groupSlug,
        description: null,
        icon: null,
        color: null,
        order: 0,
        isActive: true,
      });
    }

    const subGroupSlug = Slug.create(finalSubGroupName).value;
    let subGroup = await this.subGroupRepository.findBySlug(subGroupSlug, group.id);
    if (!subGroup) {
      subGroup = await this.subGroupRepository.create({
        id: uuidv4(),
        groupId: group.id,
        name: finalSubGroupName,
        slug: subGroupSlug,
        description: null,
        icon: null,
        order: 0,
        isActive: true,
      });
    }

    const slug = Slug.create(finalName);
    const existingLayer = await this.layerRepository.findBySlug(slug.value, layer.instanceId);
    if (existingLayer) {
      throw new ConflictError(
        'Une couche du catalogue porte déjà ce nom sur cette instance - choisissez un autre nom.',
      );
    }

    let sourceUrl: string;
    let sourceLayerName: string;
    let finalSchema: string | null = null;
    let finalTable: string | null = null;

    if (layer.sourceType === 'FILE') {
      if (!layer.schemaName || !layer.tableName || !layer.geometryType) {
        throw new ValidationError('Donnée personnelle incomplète, impossible de la publier.', {});
      }
      finalSchema = instance.slug;
      finalTable = `${instance.slug}_${slug.value}`.replace(/\W/g, '');

      const tableExists = await this.postGISService.tableExists(finalSchema, finalTable);
      if (tableExists) {
        throw new ConflictError(
          `La table "${finalSchema}"."${finalTable}" existe déjà dans la base de données. Veuillez choisir un autre nom pour la couche.`,
        );
      }

      await this.postGISService.createSchema(finalSchema);

      // Détermine où se trouve actuellement la table (personal_data vs schéma cible)
      // pour gérer de manière transparente les reprises sur échec (auto-correction/self-healing).
      let currentSchema = layer.schemaName;
      const existsInTarget = await this.postGISService.tableExists(finalSchema, layer.tableName);
      if (existsInTarget) {
        currentSchema = finalSchema;
      } else {
        const existsInOriginal = await this.postGISService.tableExists(
          layer.schemaName,
          layer.tableName,
        );
        if (!existsInOriginal) {
          throw new ValidationError(
            `La table de données "${layer.schemaName}"."${layer.tableName}" est introuvable.`,
            {},
          );
        }
      }

      await this.prisma.$transaction(async (tx) => {
        if (currentSchema !== finalSchema) {
          await tx.$executeRawUnsafe(
            `ALTER TABLE "${currentSchema}"."${layer.tableName}" SET SCHEMA "${finalSchema}"`,
          );
        }
        await tx.$executeRawUnsafe(
          `ALTER TABLE "${finalSchema}"."${layer.tableName}" RENAME TO "${finalTable}"`,
        );
        await tx.$executeRawUnsafe(
          `CREATE INDEX IF NOT EXISTS "${finalTable}_geom_idx" ON "${finalSchema}"."${finalTable}" USING GIST(geom)`,
        );
      });

      const projectPath = this.qgisProjectService.getProjectPath(instance.slug);
      const pgUri = buildQgisPgUri(finalSchema, finalTable, {
        keyColumn: 'id',
        geometryType: layer.geometryType,
      });
      try {
        const qgisResult = await this.qgisProjectService.addVectorLayer(
          projectPath,
          pgUri,
          finalTable,
        );
        if (!qgisResult.success) {
          logger.warn('QGIS addVectorLayer a échoué pour la donnée personnelle publiée', {
            finalTable,
            error: qgisResult.error,
          });
        }
      } catch (qErr) {
        logger.warn('Exception QGIS addVectorLayer pour la donnée personnelle publiée', {
          finalTable,
          error: String(qErr),
        });
      }

      // Style à appliquer maintenant que la couche existe réellement dans le projet QGIS de
      // l'instance (jamais avant) - priorité au QML natif optionnellement téléversé par
      // l'utilisateur (voir UploadPersonalLayerQmlStyleUseCase) ; à défaut, reprend le style
      // couleur/forme qu'il avait déjà choisi dans son aperçu privé (ApplyPersonalLayerStyleUseCase)
      // plutôt que de laisser QGIS appliquer son style aléatoire par défaut. Les deux chemins sont
      // non-fatals comme addVectorLayer ci-dessus : un échec de style ne doit jamais faire échouer
      // la publication elle-même.
      const personalStyle = layer.style as {
        qmlPath?: string;
        color?: string;
        shape?: string;
      } | null;
      if (personalStyle?.qmlPath) {
        try {
          const styleResult = await this.qgisProjectService.setLayerStyle(
            projectPath,
            finalTable,
            personalStyle.qmlPath,
          );
          if (!styleResult.success) {
            logger.warn("Échec de l'application du style QML personnel à la publication", {
              finalTable,
              error: styleResult.error,
            });
          }
        } catch (qErr) {
          logger.warn("Exception lors de l'application du style QML personnel", {
            finalTable,
            error: String(qErr),
          });
        }
      } else if (personalStyle?.color) {
        try {
          const styleResult = await this.qgisProjectService.applySimpleStyle(
            projectPath,
            finalTable,
            layer.geometryType,
            personalStyle.color,
            personalStyle.shape || 'circle',
          );
          if (!styleResult.success) {
            logger.warn('Échec de la reprise du style couleur/forme personnel à la publication', {
              finalTable,
              error: styleResult.error,
            });
          }
        } catch (qErr) {
          logger.warn('Exception lors de la reprise du style couleur/forme personnel', {
            finalTable,
            error: String(qErr),
          });
        }
      }

      sourceUrl = `${config.QGIS_PUBLIC_URL}?map=${projectPath}`;
      sourceLayerName = finalTable;
    } else {
      if (!layer.qgisProjectPath || !layer.sourceLayerName) {
        throw new ValidationError('Donnée personnelle incomplète, impossible de la publier.', {});
      }
      sourceUrl = `${config.QGIS_PUBLIC_URL}?map=${layer.qgisProjectPath}`;
      sourceLayerName = layer.sourceLayerName;
    }

    const createdLayer = await this.layerRepository.create({
      id: uuidv4(),
      name: finalName,
      slug: slug.value,
      description: layer.description ?? null,
      geometryType: (layer.geometryType as GeometryType) ?? GeometryType.POINT,
      sourceType: SourceType.WMS,
      sourceUrl,
      sourceLayer: sourceLayerName,
      tableName: finalTable,
      schemaName: finalSchema,
      minZoom: 0,
      maxZoom: 22,
      isVisible: false,
      isQueryable: true,
      opacity: 1,
      order: 0,
      metadata: {
        publishedAt: new Date().toISOString(),
        source: 'personal-layer',
        publishedFromPersonalLayerId: layer.id,
        publishedByUserId: layer.userId,
      },
      subGroupId: subGroup.id,
      instanceId: layer.instanceId,
      qgisProjectId: null,
    });

    if (input.overrideName || input.overrideGroupName || input.overrideSubGroupName) {
      await this.personalLayerRepository.updateOverrides(input.personalLayerId, {
        name: finalName,
        groupName: finalGroupName,
        subGroupName: finalSubGroupName,
      });
    }

    const published = await this.personalLayerRepository.updateStatus(input.personalLayerId, {
      status: 'PUBLISHED',
      reviewedBy: input.reviewerId,
      reviewNote: input.reviewNote ?? null,
      publishedLayerId: createdLayer.id,
    });

    logger.info('Donnée personnelle publiée sur le catalogue', {
      personalLayerId: input.personalLayerId,
      publishedLayerId: createdLayer.id,
      instanceId: layer.instanceId,
    });

    return published;
  }
}
