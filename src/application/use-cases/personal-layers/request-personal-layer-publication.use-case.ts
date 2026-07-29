import {
  PrismaPersonalLayerRepository,
  PersonalLayerRecord,
} from '../../../infrastructure/database/repositories/prisma-personal-layer.repository.js';
import { AlertingService } from '../../../infrastructure/observability/alerting.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RequestPersonalLayerPublicationUseCase');

/**
 * Passe une donnée personnelle en PENDING_PUBLICATION et alerte l'équipe (même canal Slack que
 * SubmitFeedbackUseCase, pas de fan-out par email vers les admins - aucun mécanisme de ce type
 * n'existe ailleurs dans le code, pas la peine d'en inventer un ici).
 */
export class RequestPersonalLayerPublicationUseCase {
  constructor(
    private readonly personalLayerRepository: PrismaPersonalLayerRepository,
    private readonly alertingService: AlertingService,
  ) {}

  async execute(
    userId: string,
    personalLayerId: string,
    publicationNote?: string,
  ): Promise<PersonalLayerRecord> {
    const layer = await this.personalLayerRepository.findById(personalLayerId);
    if (!layer) throw new NotFoundError('PersonalLayer', personalLayerId);
    if (layer.userId !== userId) {
      throw new ForbiddenError('Cette donnée ne vous appartient pas.');
    }
    if (layer.status !== 'PRIVATE' && layer.status !== 'REJECTED') {
      throw new ValidationError('Cette donnée est déjà publiée ou en attente de validation.', {});
    }

    const updated = await this.personalLayerRepository.requestPublication(
      personalLayerId,
      publicationNote,
    );

    logger.info('Publication demandée pour une donnée personnelle', {
      personalLayerId,
      userId,
      instanceId: layer.instanceId,
    });

    await this.alertingService.sendAlert(
      'WARNING',
      `Demande de publication : ${layer.name}`,
      publicationNote || 'Un utilisateur souhaite publier une donnée personnelle sur le catalogue.',
      {
        personalLayerId,
        userId,
        instanceId: layer.instanceId,
        groupName: layer.groupName,
        subGroupName: layer.subGroupName,
        sourceType: layer.sourceType,
      },
    );

    return updated;
  }
}
