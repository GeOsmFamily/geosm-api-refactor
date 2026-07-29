import { v4 as uuidv4 } from 'uuid';
import { IGroupRepository } from '../../../domain/repositories/group.repository.js';
import { ISubGroupRepository } from '../../../domain/repositories/sub-group.repository.js';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import {
  CreateLayersFromQgisProjectUseCase,
  QgisLayerSelection,
} from './create-layers-from-qgis-project.use-case.js';
import { Layer } from '../../../domain/entities/layer.entity.js';
import { GeometryType } from '../../../domain/enums.js';
import { Slug } from '../../../domain/value-objects/slug.vo.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AutoImportQgisProjectUseCase');

const DEFAULT_GROUP_NAME = 'Import QGIS';
const DEFAULT_SUBGROUP_NAME = 'Général';

interface QgisTreeGroupNode {
  type: 'group';
  name: string;
  children: QgisTreeNode[];
}
interface QgisTreeLayerNode {
  type: 'layer';
  name: string;
  geometryType?: string;
}
type QgisTreeNode = QgisTreeGroupNode | QgisTreeLayerNode;

/**
 * Importe TOUTES les couches d'un projet QGIS d'un coup, en recréant automatiquement la
 * thématique (Group) et sous-thématique (SubGroup) GeOSM correspondant à l'arborescence réelle
 * du projet (groupes/sous-dossiers QGIS) - contrairement à CreateLayersFromQgisProjectUseCase
 * (utilisé par l'assistant de création de couche admin), qui exige qu'un unique subGroupId soit
 * choisi manuellement pour toutes les couches sélectionnées. Le style QGIS embarqué dans le
 * projet est déjà préservé sans travail supplémentaire (les couches créées pointent vers le WMS
 * du projet, qui rend avec son style natif - voir CreateLayersFromQgisProjectUseCase).
 *
 * Le modèle GeOSM est strictement Groupe > Sous-groupe > Couche (2 niveaux), alors qu'un projet
 * QGIS peut imbriquer des groupes à profondeur arbitraire ou poser des couches directement à la
 * racine/dans un groupe sans sous-dossier - ces cas sont repliés dans un sous-groupe "Général"
 * plutôt que de échouer ou de perdre des couches.
 */
export class AutoImportQgisProjectUseCase {
  constructor(
    private readonly groupRepository: IGroupRepository,
    private readonly subGroupRepository: ISubGroupRepository,
    private readonly qgisProjectRepository: IQgisProjectRepository,
    private readonly qgisProjectService: QGISProjectService,
    private readonly createLayersFromQgisProjectUseCase: CreateLayersFromQgisProjectUseCase,
  ) {}

  async execute(instanceId: string, qgisProjectId: string): Promise<Layer[]> {
    const project = await this.qgisProjectRepository.findById(qgisProjectId);
    if (!project) throw new NotFoundError('QgisProject', qgisProjectId);

    const result = await this.qgisProjectService.listProjectTree(project.filePath);
    if (!result.success || !Array.isArray(result['tree'])) {
      throw new ValidationError(
        `Échec de lecture de la structure du projet QGIS: ${result.error ?? 'réponse invalide'}`,
        {},
      );
    }

    const buckets = new Map<string, { subGroupId: string; layers: QgisLayerSelection[] }>();
    const subGroupIdCache = new Map<string, string>();

    const resolveSubGroupId = async (groupName: string, subGroupName: string): Promise<string> => {
      const cacheKey = `${groupName}::${subGroupName}`;
      const cached = subGroupIdCache.get(cacheKey);
      if (cached) return cached;

      const groupSlug = Slug.create(groupName).value;
      let group = await this.groupRepository.findBySlug(groupSlug, instanceId);
      if (!group) {
        group = await this.groupRepository.create({
          id: uuidv4(),
          instanceId,
          name: groupName,
          slug: groupSlug,
          description: null,
          icon: null,
          color: null,
          order: 0,
          isActive: true,
        });
        logger.info("Groupe créé depuis l'arborescence QGIS", { groupName, instanceId });
      }

      const subGroupSlug = Slug.create(subGroupName).value;
      let subGroup = await this.subGroupRepository.findBySlug(subGroupSlug, group.id);
      if (!subGroup) {
        subGroup = await this.subGroupRepository.create({
          id: uuidv4(),
          groupId: group.id,
          name: subGroupName,
          slug: subGroupSlug,
          description: null,
          icon: null,
          order: 0,
          isActive: true,
        });
        logger.info("Sous-groupe créé depuis l'arborescence QGIS", {
          subGroupName,
          groupId: group.id,
        });
      }

      subGroupIdCache.set(cacheKey, subGroup.id);
      return subGroup.id;
    };

    const collect = async (
      nodes: QgisTreeNode[],
      groupName: string | null,
      subGroupName: string | null,
    ): Promise<void> => {
      for (const node of nodes) {
        if (node.type === 'group') {
          if (!groupName) {
            // Groupe de premier niveau du projet QGIS -> devient un Groupe GeOSM. Ses enfants
            // directs (couches sans sous-dossier) tomberont dans un sous-groupe "Général".
            await collect(node.children, node.name, null);
          } else {
            // Sous-dossier au sein d'un groupe déjà identifié -> devient un Sous-groupe GeOSM.
            await collect(node.children, groupName, node.name);
          }
        } else {
          const resolvedGroup = groupName ?? DEFAULT_GROUP_NAME;
          const resolvedSubGroup = subGroupName ?? DEFAULT_SUBGROUP_NAME;
          const subGroupId = await resolveSubGroupId(resolvedGroup, resolvedSubGroup);

          const bucketKey = subGroupId;
          if (!buckets.has(bucketKey)) buckets.set(bucketKey, { subGroupId, layers: [] });
          buckets.get(bucketKey)!.layers.push({
            layerName: node.name,
            displayName: node.name,
            geometryType: this.mapGeometryType(node.geometryType),
          });
        }
      }
    };

    await collect(result['tree'] as QgisTreeNode[], null, null);

    if (buckets.size === 0) {
      throw new ValidationError('Ce projet QGIS ne contient aucune couche exploitable.', {});
    }

    const created: Layer[] = [];
    for (const { subGroupId, layers } of buckets.values()) {
      const layersCreated = await this.createLayersFromQgisProjectUseCase.execute(instanceId, {
        qgisProjectId,
        subGroupId,
        layers,
      });
      created.push(...layersCreated);
    }

    logger.info('Import automatique de projet QGIS terminé', {
      instanceId,
      qgisProjectId,
      groupsAndSubGroups: buckets.size,
      layersCreated: created.length,
    });

    return created;
  }

  private mapGeometryType(value: string | undefined): GeometryType {
    switch (value) {
      case 'LINESTRING':
        return GeometryType.LINESTRING;
      case 'POLYGON':
        return GeometryType.POLYGON;
      default:
        return GeometryType.POINT;
    }
  }
}
