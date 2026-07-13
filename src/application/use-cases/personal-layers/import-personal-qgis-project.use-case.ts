import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readdir } from 'fs/promises';
import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { QGISProjectService } from '../../../infrastructure/qgis/qgis-project.service.js';
import { GeometryType } from '../../../domain/enums.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const execAsync = promisify(exec);
const logger = createChildLogger('ImportPersonalQgisProjectUseCase');

const DEFAULT_GROUP_NAME = 'Mon projet QGIS';
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

export interface ImportPersonalQgisProjectInput {
  userId: string;
  instanceId: string;
  uploadedFilePath: string;
  originalFilename: string;
}

/**
 * Héberge un projet QGIS déposé par un utilisateur SOUS UN RÉPERTOIRE ISOLÉ PAR UTILISATEUR
 * (QGIS_PROJECTS_DIR/personal/<userId>/<uuid>/), jamais mélangé aux projets d'instance
 * (UploadQgisProjectUseCase) ni enregistré comme QgisProject partagé - puis extrait son
 * arborescence réelle (même script que AutoImportQgisProjectUseCase, list_qgis_project_tree.py)
 * pour créer une PersonalLayer PRIVÉE par couche, organisée selon les groupes/sous-dossiers du
 * projet. Le style QGIS natif du projet est préservé sans travail supplémentaire : chaque
 * PersonalLayer pointe vers le WMS de CE projet privé (jamais celui de l'instance).
 */
export class ImportPersonalQgisProjectUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly qgisProjectService: QGISProjectService,
  ) {}

  async execute(input: ImportPersonalQgisProjectInput): Promise<PersonalLayerRecord[]> {
    const filePath = await this.stagePersonalProjectFile(input.userId, input);

    const result = await this.qgisProjectService.listProjectTree(filePath);
    if (!result.success || !Array.isArray(result['tree'])) {
      throw new ValidationError(
        `Échec de lecture de la structure du projet QGIS: ${result.error ?? 'réponse invalide'}`,
        {},
      );
    }

    const leaves: { groupName: string; subGroupName: string; node: QgisTreeLayerNode }[] = [];
    const collect = (
      nodes: QgisTreeNode[],
      groupName: string | null,
      subGroupName: string | null,
    ): void => {
      for (const node of nodes) {
        if (node.type === 'group') {
          if (!groupName) {
            collect(node.children, node.name, null);
          } else {
            collect(node.children, groupName, node.name);
          }
        } else {
          leaves.push({
            groupName: groupName ?? DEFAULT_GROUP_NAME,
            subGroupName: subGroupName ?? DEFAULT_SUBGROUP_NAME,
            node,
          });
        }
      }
    };
    collect(result['tree'] as QgisTreeNode[], null, null);

    if (leaves.length === 0) {
      throw new ValidationError('Ce projet QGIS ne contient aucune couche exploitable.', {});
    }

    const created: PersonalLayerRecord[] = [];
    for (const leaf of leaves) {
      const record = await this.personalLayerRepository.create({
        id: uuidv4(),
        userId: input.userId,
        instanceId: input.instanceId,
        name: leaf.node.name,
        groupName: leaf.groupName,
        subGroupName: leaf.subGroupName,
        geometryType: this.mapGeometryType(leaf.node.geometryType),
        sourceType: 'QGIS_PROJECT',
        qgisProjectPath: filePath,
        sourceLayerName: leaf.node.name,
      });
      created.push(record);
    }

    logger.info('Projet QGIS personnel importé', {
      userId: input.userId,
      filePath,
      layersCreated: created.length,
    });
    return created;
  }

  private async stagePersonalProjectFile(
    userId: string,
    input: ImportPersonalQgisProjectInput,
  ): Promise<string> {
    const uploadId = uuidv4();
    const destDir = path.join(config.QGIS_PROJECTS_DIR, 'personal', userId, uploadId);
    const ext = path.extname(input.originalFilename).toLowerCase();

    if (ext === '.qgz' || ext === '.qgs') {
      await execAsync(`mkdir -p "${destDir}"`);
      const destFile = path.join(destDir, `project${ext}`);
      await execAsync(`cp "${input.uploadedFilePath}" "${destFile}"`);
      return destFile;
    }
    if (ext === '.zip') {
      await execAsync(`mkdir -p "${destDir}"`);
      try {
        await execAsync(`unzip -o "${input.uploadedFilePath}" -d "${destDir}"`);
      } catch (error) {
        throw new ValidationError("Échec de l'extraction de l'archive du projet QGIS.", {
          error: String(error),
        });
      }
      const qgsPath = await this.findQgsFile(destDir);
      if (!qgsPath) {
        throw new ValidationError("Aucun fichier .qgs trouvé dans l'archive fournie.", {});
      }
      return qgsPath;
    }
    throw new ValidationError('Format de projet QGIS non supporté (.qgz, .qgs ou .zip attendu).', {
      originalFilename: input.originalFilename,
    });
  }

  private async findQgsFile(dir: string, depth = 0): Promise<string | null> {
    if (depth > 2) return null;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.qgs')) return full;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = await this.findQgsFile(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
    return null;
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
