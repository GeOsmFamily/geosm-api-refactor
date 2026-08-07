import type { PrismaNotificationRepository } from '../../../infrastructure/database/repositories/prisma-notification.repository.js';

export class MarkAllNotificationsReadUseCase {
  constructor(private readonly notificationRepository: PrismaNotificationRepository) {}

  execute(userId: string): Promise<number> {
    return this.notificationRepository.markAllRead(userId);
  }
}
