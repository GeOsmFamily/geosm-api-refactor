import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import type { PrismaClient } from '@prisma/client';
import { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const execAsync = promisify(exec);
const logger = createChildLogger('CreateInstanceTemplateUseCase');

export interface InstanceTemplateInput {
  name: string;
  slug: string;
  description?: string;
  thematiques?: string[];
  // Clone le catalogue (Group→SubGroup→Layer→LayerStyle→LayerAction) + les BaseMap d'une
  // instance existante, au lieu des thématiques par défaut - voir plan "Interopérabilité &
  // sécurité des données" du 2026-08-06. Ne clone JAMAIS les tables de données PostGIS
  // elles-mêmes (périmètre confirmé avec l'utilisateur) - un Layer cloné référence encore les
  // mêmes sourceUrl/tableName que l'original tant qu'un admin ne les reconfigure pas.
  sourceInstanceId?: string;
}

export class CreateInstanceTemplateUseCase {
  constructor(
    private readonly instanceRepository: IInstanceRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(input: InstanceTemplateInput) {
    const instance = await this.instanceRepository.create({
      id: randomUUID(),
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      logo: null,
      bbox: null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 6,
      boundaryTable: null,
      boundaryId: null,
      boundaryGeomCol: null,
      adminLevel: null,
      parentInstanceId: null,
      isActive: true,
    });

    if (input.sourceInstanceId) {
      const cloned = await this.cloneCatalog(input.sourceInstanceId, instance.id);
      logger.info('Instance créée par clonage de catalogue', {
        instanceId: instance.id,
        sourceInstanceId: input.sourceInstanceId,
        ...cloned,
      });
      return instance;
    }

    // Anciennement une insertion SQL brute visant la table `"Group"` (avec majuscule, entre
    // guillemets) - la vraie table est `groups` (voir @@map côté schema.prisma), avec des
    // colonnes snake_case, pas camelCase, et sans jamais renseigner `slug` (NOT NULL, partie
    // de @@unique([slug, instanceId])) : cette insertion échouait donc déjà systématiquement
    // en conditions réelles. Remplacée par de vrais appels Prisma Client, type-sûrs.
    const defaultThematiques = input.thematiques ?? [
      'Environnement',
      'Transport',
      'Administration',
      'Urbanisme',
    ];
    for (let i = 0; i < defaultThematiques.length; i++) {
      await this.prisma.group.create({
        data: {
          name: defaultThematiques[i],
          slug: Slug.create(defaultThematiques[i]).value,
          color: '#3B82F6',
          icon: 'folder',
          order: i,
          instanceId: instance.id,
        },
      });
    }

    logger.info('Instance template created', {
      instanceId: instance.id,
      slug: instance.slug,
      thematiquesCount: defaultThematiques.length,
    });
    return instance;
  }

  /** Clone récursivement Group→SubGroup→Layer→LayerStyle→LayerAction et les BaseMap d'une
   * instance source. Un Layer référençant un QgisProject voit ce projet physiquement dupliqué
   * sur disque (voir cloneQgisProject) pour que la nouvelle instance reste indépendante de la
   * source au niveau du FICHIER de projet (éditer le projet QGIS de l'une n'affecte pas
   * l'autre) - mais les données PostGIS pointées par sourceUrl/tableName restent partagées,
   * conformément au périmètre "catalogue + styles seulement". */
  private async cloneCatalog(
    sourceInstanceId: string,
    targetInstanceId: string,
  ): Promise<{ groupsCloned: number; layersCloned: number; baseMapsCloned: number }> {
    const source = await this.instanceRepository.findById(sourceInstanceId);
    if (!source) throw new NotFoundError('Instance', sourceInstanceId);

    const groups = await this.prisma.group.findMany({
      where: { instanceId: sourceInstanceId },
      include: {
        subGroups: { include: { layers: { include: { styles: true, actions: true } } } },
      },
      orderBy: { order: 'asc' },
    });

    // Un même projet QGIS peut être référencé par plusieurs Layer (plusieurs sous-couches d'un
    // même fichier .qgs) - dupliqué une seule fois, pas une fois par Layer qui le référence.
    const clonedQgisProjectIds = new Map<string, string | null>();
    let layersCloned = 0;

    for (const group of groups) {
      const newGroup = await this.prisma.group.create({
        data: {
          name: group.name,
          slug: group.slug,
          description: group.description,
          icon: group.icon,
          color: group.color,
          order: group.order,
          isActive: group.isActive,
          instanceId: targetInstanceId,
        },
      });

      for (const subGroup of group.subGroups) {
        const newSubGroup = await this.prisma.subGroup.create({
          data: {
            name: subGroup.name,
            slug: subGroup.slug,
            description: subGroup.description,
            icon: subGroup.icon,
            order: subGroup.order,
            isActive: subGroup.isActive,
            groupId: newGroup.id,
          },
        });

        for (const layer of subGroup.layers) {
          let newQgisProjectId: string | null = null;
          if (layer.qgisProjectId) {
            if (clonedQgisProjectIds.has(layer.qgisProjectId)) {
              newQgisProjectId = clonedQgisProjectIds.get(layer.qgisProjectId)!;
            } else {
              newQgisProjectId = await this.cloneQgisProject(layer.qgisProjectId, targetInstanceId);
              clonedQgisProjectIds.set(layer.qgisProjectId, newQgisProjectId);
            }
          }

          const newLayer = await this.prisma.layer.create({
            data: {
              name: layer.name,
              slug: layer.slug,
              description: layer.description,
              geometryType: layer.geometryType,
              sourceType: layer.sourceType,
              sourceUrl: layer.sourceUrl,
              sourceLayer: layer.sourceLayer,
              tableName: layer.tableName,
              schemaName: layer.schemaName,
              minZoom: layer.minZoom,
              maxZoom: layer.maxZoom,
              isVisible: layer.isVisible,
              isQueryable: layer.isQueryable,
              opacity: layer.opacity,
              order: layer.order,
              metadata: layer.metadata ?? undefined,
              subGroupId: newSubGroup.id,
              instanceId: targetInstanceId,
              qgisProjectId: newQgisProjectId,
            },
          });
          layersCloned++;

          for (const style of layer.styles) {
            await this.prisma.layerStyle.create({
              data: {
                name: style.name,
                sldBody: style.sldBody,
                mapboxStyle: style.mapboxStyle ?? undefined,
                isDefault: style.isDefault,
                layerId: newLayer.id,
              },
            });
          }
          for (const action of layer.actions) {
            await this.prisma.layerAction.create({
              data: {
                type: action.type,
                isEnabled: action.isEnabled,
                config: action.config ?? undefined,
                layerId: newLayer.id,
              },
            });
          }
        }
      }
    }

    const baseMaps = await this.prisma.baseMap.findMany({ where: { instanceId: sourceInstanceId } });
    for (const baseMap of baseMaps) {
      await this.prisma.baseMap.create({
        data: {
          name: baseMap.name,
          slug: baseMap.slug,
          type: baseMap.type,
          url: baseMap.url,
          thumbnail: baseMap.thumbnail,
          attribution: baseMap.attribution,
          isDefault: baseMap.isDefault,
          order: baseMap.order,
          config: baseMap.config ?? undefined,
          instanceId: targetInstanceId,
        },
      });
    }

    return { groupsCloned: groups.length, layersCloned, baseMapsCloned: baseMaps.length };
  }

  /** Duplique physiquement le répertoire d'un projet QGIS (fichier .qgs/.qgz + éventuels
   * fichiers compagnons) sous un nouvel identifiant - même idiome que
   * UploadQgisProjectUseCase (cp via child_process.exec) - pour que la nouvelle instance
   * possède sa propre copie indépendante plutôt que de partager le fichier source. Un échec de
   * copie n'interrompt jamais le clonage global : la couche est créée sans projet QGIS associé
   * plutôt que de faire échouer tout le modèle pour un seul fichier illisible. */
  private async cloneQgisProject(
    sourceProjectId: string,
    targetInstanceId: string,
  ): Promise<string | null> {
    const source = await this.prisma.qgisProject.findUnique({ where: { id: sourceProjectId } });
    if (!source) return null;

    const sourceDir = path.dirname(source.filePath);
    const fileName = path.basename(source.filePath);
    const destDir = path.join(config.QGIS_PROJECTS_DIR, 'templates', randomUUID());
    const destFile = path.join(destDir, fileName);

    try {
      await execAsync(`mkdir -p "${destDir}"`);
      await execAsync(`cp -r "${sourceDir}/." "${destDir}"`);
    } catch (error) {
      logger.warn('Échec de la duplication du projet QGIS - la couche clonée restera sans projet', {
        sourceProjectId,
        error: error instanceof Error ? error.message : error,
      });
      return null;
    }

    const newProject = await this.prisma.qgisProject.create({
      data: {
        name: source.name,
        filePath: destFile,
        description: source.description,
        instanceId: targetInstanceId,
      },
    });
    return newProject.id;
  }
}
