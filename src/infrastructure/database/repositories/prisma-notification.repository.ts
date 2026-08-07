import type { PrismaClient, Prisma } from '@prisma/client';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}

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
