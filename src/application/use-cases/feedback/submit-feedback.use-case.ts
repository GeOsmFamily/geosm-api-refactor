import { v4 as uuidv4 } from 'uuid';
import { FeedbackType } from '@prisma/client';
import {
  PrismaFeedbackRepository,
  FeedbackRecord,
} from '../../../infrastructure/database/repositories/prisma-feedback.repository.js';
import { AlertingService } from '../../../infrastructure/observability/alerting.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('SubmitFeedbackUseCase');

export interface SubmitFeedbackDTO {
  type: FeedbackType;
  description: string;
  contactEmail?: string;
  page?: string;
}

/**
 * Formulaire de signalement du bouton "Infos" - accessible à un visiteur non connecté
 * (userId optionnel), notifie l'équipe via Slack (AlertingService, canal déjà existant plutôt
 * que d'en construire un nouveau) sans jamais bloquer la soumission si Slack échoue.
 */
export class SubmitFeedbackUseCase {
  constructor(
    private readonly feedbackRepository: PrismaFeedbackRepository,
    private readonly alertingService: AlertingService,
  ) {}

  async execute(dto: SubmitFeedbackDTO, userId: string | undefined): Promise<FeedbackRecord> {
    const feedback = await this.feedbackRepository.create({
      id: uuidv4(),
      type: dto.type,
      description: dto.description,
      contactEmail: dto.contactEmail ?? null,
      page: dto.page ?? null,
      userId: userId ?? null,
    });

    logger.info('Feedback submitted', { feedbackId: feedback.id, type: dto.type, userId });

    // sendAlert() ne lève jamais (erreurs Slack/email déjà avalées en interne, voir
    // AlertingService) - une notification ratée ne doit jamais faire échouer la soumission.
    await this.alertingService.sendAlert(
      'WARNING',
      `Nouveau signalement (${dto.type})`,
      dto.description,
      { contactEmail: dto.contactEmail, page: dto.page, userId, feedbackId: feedback.id },
    );

    return feedback;
  }
}
