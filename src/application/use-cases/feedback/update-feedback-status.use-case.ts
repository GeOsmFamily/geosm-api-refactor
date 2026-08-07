import { FeedbackStatus } from '@prisma/client';
import {
  PrismaFeedbackRepository,
  FeedbackRecord,
} from '../../../infrastructure/database/repositories/prisma-feedback.repository.js';
import type { NotificationService } from '../../../infrastructure/websocket/notification.service.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UpdateFeedbackStatusUseCase');

export class UpdateFeedbackStatusUseCase {
  constructor(
    private readonly feedbackRepository: PrismaFeedbackRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(id: string, status: FeedbackStatus, adminNotes?: string): Promise<FeedbackRecord> {
    const feedback = await this.feedbackRepository.findById(id);
    if (!feedback) throw new NotFoundError('FeedbackSubmission', id);

    logger.info('Feedback status updated', { feedbackId: id, status });
    const updated = await this.feedbackRepository.updateStatus(id, status, adminNotes ?? null);

    // FeedbackSubmission.userId est nullable (retour anonyme, seulement un contactEmail
    // possible) - pas de compte à notifier dans ce cas, contactEmail n'est pas un canal de
    // notification de ce système (voir plan "Centre de notifications unifié" du 2026-08-06).
    if (feedback.userId) {
      void this.notificationService.notifyUser(feedback.userId, 'feedback-status-change', {
        feedbackId: id,
        status,
      });
    }

    return updated;
  }
}
