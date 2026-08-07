import type {
  PrismaNotificationRepository,
  NotificationRecord,
} from '../../../infrastructure/database/repositories/prisma-notification.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';

/** Marque une notification comme lue - vérifie l'appartenance (même idiome que
 * GetPersonalLayerFeaturesUseCase/RateAnalysisReportUseCase) : seul le destinataire peut marquer
 * sa propre notification comme lue. */
export class MarkNotificationReadUseCase {
  constructor(private readonly notificationRepository: PrismaNotificationRepository) {}

  async execute(userId: string, notificationId: string): Promise<NotificationRecord> {
    const notification = await this.notificationRepository.findById(notificationId);
    if (!notification) throw new NotFoundError('Notification', notificationId);
    if (notification.userId !== userId) {
      throw new ForbiddenError('Cette notification ne vous appartient pas.');
    }
    return this.notificationRepository.markRead(notificationId);
  }
}
