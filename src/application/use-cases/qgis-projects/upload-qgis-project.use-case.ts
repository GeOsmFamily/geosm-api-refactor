import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readdir } from 'fs/promises';
import { IQgisProjectRepository } from '../../../domain/repositories/qgis-project.repository.js';
import { QgisProject } from '../../../domain/entities/qgis-project.entity.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const execAsync = promisify(exec);
const logger = createChildLogger('UploadQgisProjectUseCase');

export interface UploadQgisProjectInput {
  instanceId: string;
  name: string;
  description?: string;
  /** Chemin temporaire du fichier uploadé (.qgz autonome, ou .zip contenant un .qgs + ses données). */
  uploadedFilePath: string;
  originalFilename: string;
}

/**
 * Héberge un projet QGIS fourni par un utilisateur (assistant admin, source "Projet QGIS") :
 * .qgz (archive autonome, lue directement par QGIS Server sans extraction) ou .zip contenant un
 * .qgs accompagné de ses fichiers de données (extrait sur disque pour que les chemins relatifs
 * référencés par le .qgs restent valides). Le projet est stocké sous un répertoire dédié
 * (QGIS_PROJECTS_DIR/uploads/<uuid>) distinct des projets par défaut créés à l'instanciation,
 * pour ne jamais risquer d'écraser un projet existant.
 */
export class UploadQgisProjectUseCase {
  constructor(private readonly qgisProjectRepository: IQgisProjectRepository) {}

  async execute(input: UploadQgisProjectInput): Promise<QgisProject> {
    const uploadId = uuidv4();
    const destDir = path.join(config.QGIS_PROJECTS_DIR, 'uploads', uploadId);
    const ext = path.extname(input.originalFilename).toLowerCase();

    let filePath: string;
    if (ext === '.qgz' || ext === '.qgs') {
      await execAsync(`mkdir -p "${destDir}"`);
      const destFile = path.join(destDir, `project${ext}`);
      await execAsync(`cp "${input.uploadedFilePath}" "${destFile}"`);
      filePath = destFile;
    } else if (ext === '.zip') {
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
      filePath = qgsPath;
    } else {
      throw new ValidationError(
        'Format de projet QGIS non supporté (.qgz, .qgs ou .zip attendu).',
        { originalFilename: input.originalFilename },
      );
    }

    const project = await this.qgisProjectRepository.create({
      id: uuidv4(),
      name: input.name,
      filePath,
      description: input.description ?? null,
      instanceId: input.instanceId,
    });

    logger.info('Projet QGIS uploadé', { projectId: project.id, filePath });
    return project;
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
}
