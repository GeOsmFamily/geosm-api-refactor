import { PrismaClient, Prisma } from '@prisma/client';

export interface AnalyticsEventRecord {
  id: string;
  eventType: string;
  userId: string | null;
  instanceId: string;
  layerId: string | null;
  metadata: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: Date;
}

export interface AnalyticsAggregation {
  eventType: string;
  count: number;
}

export class PrismaAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: { id: string; eventType: string; userId: string | null; instanceId: string; layerId: string | null; metadata: Prisma.InputJsonValue | null; ipAddress: string | null }): Promise<AnalyticsEventRecord> {
    return this.prisma.analyticsEvent.create({ data: { ...data, metadata: data.metadata ?? Prisma.JsonNull } }) as Promise<AnalyticsEventRecord>;
  }

  async getAggregatedStats(
    instanceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AnalyticsAggregation[]> {
    const where: Record<string, unknown> = { instanceId };
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.gte = startDate;
      if (endDate) createdAt.lte = endDate;
      where.createdAt = createdAt;
    }

    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { id: true },
    });

    return result.map((r) => ({
      eventType: r.eventType,
      count: r._count.id,
    }));
  }
}
