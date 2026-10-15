import type { PrismaClient, Prisma } from '@prisma/client';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Evenements de taches de fond (export, import, plan de localisation, rapport d'analyse) : tres
 * nombreux (plusieurs `:progress` par tache) et deja visibles dans le tiroir de taches. Ils sont
 * persistes comme les autres notifications mais ne doivent pas alimenter les pastilles de la
 * barre de navigation.
 */
export const JOB_EVENT_PREFIXES = ['export:', 'import:', 'location-plan:', 'analysis-report:'] as const;

export class PrismaNotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listForUser(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean },
  ): Promise<{ data: NotificationRecord[]; total: number; unreadCount: number }> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = { userId, ...(options.unreadOnly ? { readAt: null } : {}) };

    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { data, total, unreadCount };
  }

  /** Notifications non lues hors evenements de taches de fond (pastille de la navigation). */
  countUnreadSocial(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
        NOT: { OR: JOB_EVENT_PREFIXES.map((prefix) => ({ type: { startsWith: prefix } })) },
      },
    });
  }

  /** Categories explicitement choisies par l'utilisateur ; les autres sont activees par defaut. */
  async listPreferences(userId: string): Promise<Record<string, boolean>> {
    const rows = await this.prisma.notificationPreference.findMany({ where: { userId } });
    return Object.fromEntries(rows.map((r) => [r.category, r.enabled]));
  }

  async setPreference(userId: string, category: string, enabled: boolean): Promise<void> {
    await this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, enabled },
      update: { enabled },
    });
  }

  findById(id: string): Promise<NotificationRecord | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  markRead(id: string): Promise<NotificationRecord> {
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }
}
