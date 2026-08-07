import type {
  PrismaNotificationRepository,
  NotificationRecord,
} from '../../../infrastructure/database/repositories/prisma-notification.repository.js';

export class GetMyNotificationsUseCase {
  constructor(private readonly notificationRepository: PrismaNotificationRepository) {}

  execute(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean },
  ): Promise<{ data: NotificationRecord[]; total: number; unreadCount: number }> {
    return this.notificationRepository.listForUser(userId, options);
  }
}
