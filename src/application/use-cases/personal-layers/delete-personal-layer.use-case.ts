import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPersonalLayerRepository } from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { config } from '../../../config/env.config.js';

const execAsync = promisify(exec);
const logger = createChildLogger('DeletePersonalLayerUseCase');

/**
 * Supprime une donnée personnelle : vérifie systématiquement que l'appelant en est bien le
 * propriétaire (sinon IDOR - n'importe quel utilisateur connecté pourrait supprimer les données
 * d'un autre en devinant/énumérant des ids) avant toute suppression réelle (table PostGIS pour
 * FILE, dossier de projet pour QGIS_PROJECT, puis l'enregistrement lui-même).
 */
export class DeletePersonalLayerUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(userId: string, personalLayerId: string): Promise<void> {
    const layer = await this.personalLayerRepository.findById(personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', personalLayerId);
    if (layer.userId !== userId) {
      throw new ForbiddenError("Cette donnée ne vous appartient pas.");
    }

    if (layer.sourceType === 'FILE' && layer.schemaName && layer.tableName) {
      await this.prisma
        .$executeRawUnsafe(`DROP TABLE IF EXISTS "${layer.schemaName}"."${layer.tableName}"`)
        .catch((err) => logger.warn('Échec de suppression de la table personnelle', { err: String(err) }));
    }

    if (layer.sourceType === 'QGIS_PROJECT' && layer.qgisProjectPath) {
      const projectDir = path.dirname(layer.qgisProjectPath);
      await execAsync(`rm -rf "${projectDir}"`).catch((err) =>
        logger.warn('Échec de suppression du projet QGIS personnel', { err: String(err) }),
      );
    }

    const qmlStyleDir = path.join(config.DATA_DIR, 'personal-styles', personalLayerId);
    await execAsync(`rm -rf "${qmlStyleDir}"`).catch((err) =>
      logger.warn('Échec de suppression du style QML personnel', { err: String(err) }),
    );

    await this.personalLayerRepository.delete(personalLayerId);
    logger.info('Donnée personnelle supprimée', { personalLayerId, userId });
  }
}
