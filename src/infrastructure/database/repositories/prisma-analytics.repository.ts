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

  /**
   * Couches les plus fréquemment activées ("layer_activated", voir MapLayerService.addLayer
   * côté frontend) par un utilisateur donné dans une instance - sert de base aux suggestions
   * de recherche contextuelles (l'utilisateur retrouve rapidement les couches qu'il consulte
   * le plus souvent). Si l'utilisateur n'a pas encore d'historique, l'appelant doit prévoir
   * un repli (voir GetSearchSuggestionsUseCase).
   */
  async getTopActivatedLayersForUser(userId: string, instanceId: string, limit: number): Promise<{ layerId: string; count: number }[]> {
    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['layerId'],
      where: { userId, instanceId, eventType: 'layer_activated', layerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return result.filter((r) => r.layerId).map((r) => ({ layerId: r.layerId as string, count: r._count.id }));
  }

  /** Repli "tendance instance" quand l'utilisateur courant n'a pas encore d'historique. */
  async getTopActivatedLayersForInstance(instanceId: string, limit: number): Promise<{ layerId: string; count: number }[]> {
    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['layerId'],
      where: { instanceId, eventType: 'layer_activated', layerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return result.filter((r) => r.layerId).map((r) => ({ layerId: r.layerId as string, count: r._count.id }));
  }

  /**
   * Recommandation par co-occurrence ("les utilisateurs qui ont activé X ont aussi activé
   * Y") : parmi les utilisateurs ayant activé `layerId`, quelles AUTRES couches ont-ils
   * aussi activées dans la même instance - classées par nombre d'utilisateurs distincts en
   * commun. Auto-jointure non exprimable proprement via l'API Prisma (groupBy ne supporte
   * pas les jointures), d'où le SQL brut.
   */
  async getCoActivatedLayers(layerId: string, instanceId: string, limit: number): Promise<{ layerId: string; coUserCount: number }[]> {
    const rows = await this.prisma.$queryRaw<{ layer_id: string; co_user_count: bigint }[]>`
      SELECT b.layer_id, COUNT(DISTINCT b.user_id) AS co_user_count
      FROM analytics_events a
      JOIN analytics_events b
        ON a.user_id = b.user_id
        AND a.instance_id = b.instance_id
        AND b.layer_id IS DISTINCT FROM a.layer_id
      WHERE a.layer_id = ${layerId}::uuid
        AND a.instance_id = ${instanceId}::uuid
        AND a.event_type = 'layer_activated'
        AND b.event_type = 'layer_activated'
        AND a.user_id IS NOT NULL
      GROUP BY b.layer_id
      ORDER BY co_user_count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ layerId: r.layer_id, coUserCount: Number(r.co_user_count) }));
  }
}
