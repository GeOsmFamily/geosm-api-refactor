import type { PrismaNotificationRepository } from '../../../infrastructure/database/repositories/prisma-notification.repository.js';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '../../../domain/notifications/social-notification-types.js';

export type NotificationPreferences = Record<NotificationCategory, boolean>;

/** Preferences de notification par categorie : tout est active tant que rien n'est desactive. */
export class NotificationPreferencesUseCases {
  constructor(private readonly notificationRepository: PrismaNotificationRepository) {}

  async get(userId: string): Promise<NotificationPreferences> {
    const stored = await this.notificationRepository.listPreferences(userId);
    return Object.fromEntries(
      NOTIFICATION_CATEGORIES.map((category) => [category, stored[category] ?? true]),
    ) as NotificationPreferences;
  }

  async update(
    userId: string,
    changes: Partial<Record<string, boolean>>,
  ): Promise<NotificationPreferences> {
    for (const [category, enabled] of Object.entries(changes)) {
      if (typeof enabled !== 'boolean') continue;
      if (!(NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) continue;
      await this.notificationRepository.setPreference(userId, category, enabled);
    }
    return this.get(userId);
  }
}
