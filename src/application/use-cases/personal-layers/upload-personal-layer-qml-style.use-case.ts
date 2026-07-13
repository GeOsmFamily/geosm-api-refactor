import path from 'path';
import { mkdir, copyFile } from 'fs/promises';
import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { config } from '../../../config/env.config.js';

/**
 * Stocke un style QML natif (exporté depuis QGIS Desktop) pour une donnée personnelle FILE.
 * Contrairement au catalogue partagé (ApplyLayerStyleUseCase, mode 'qml'), le fichier n'est PAS
 * appliqué immédiatement via PyQGIS - une donnée personnelle FILE n'a pas de projet QGIS tant
 * qu'elle n'est pas publiée. Le chemin est simplement mémorisé dans PersonalLayer.style.qmlPath ;
 * ReviewPersonalLayerPublicationUseCase l'applique via qgisProjectService.setLayerStyle() au
 * moment où la couche catalogue définitive est créée.
 */
export class UploadPersonalLayerQmlStyleUseCase {
  constructor(private readonly personalLayerRepository: PrismaPersonalLayerRepository) {}

  async execute(
    userId: string,
    personalLayerId: string,
    uploadedFilePath: string,
  ): Promise<PersonalLayerRecord> {
    const layer = await this.personalLayerRepository.findById(personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', personalLayerId);
    if (layer.userId !== userId) {
      throw new ForbiddenError('Cette donnée ne vous appartient pas.');
    }
    if (layer.sourceType !== 'FILE') {
      throw new ValidationError(
        'Un style QML ne se configure que pour une donnée importée depuis un fichier.',
        {},
      );
    }

    const destDir = path.join(config.DATA_DIR, 'personal-styles', personalLayerId);
    await mkdir(destDir, { recursive: true });
    const destPath = path.join(destDir, 'style.qml');
    await copyFile(uploadedFilePath, destPath);

    const existingStyle = (layer.style as Record<string, unknown> | null) ?? {};
    return this.personalLayerRepository.updateStyle(personalLayerId, {
      ...existingStyle,
      qmlPath: destPath,
    } as { color?: string; iconKey?: string; shape?: string; qmlPath?: string });
  }
}
