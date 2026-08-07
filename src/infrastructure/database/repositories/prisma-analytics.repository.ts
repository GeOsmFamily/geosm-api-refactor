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

export interface DailyCount {
  date: string;
  count: number;
}

export interface ToolUsageCount {
  tool: string;
  count: number;
}

export class PrismaAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    id: string;
    eventType: string;
    userId: string | null;
    instanceId: string;
    layerId: string | null;
    metadata: Prisma.InputJsonValue | null;
    ipAddress: string | null;
  }): Promise<AnalyticsEventRecord> {
    return this.prisma.analyticsEvent.create({
      data: { ...data, metadata: data.metadata ?? Prisma.JsonNull },
    }) as Promise<AnalyticsEventRecord>;
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
  async getTopActivatedLayersForUser(
    userId: string,
    instanceId: string,
    limit: number,
  ): Promise<{ layerId: string; count: number }[]> {
    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['layerId'],
      where: { userId, instanceId, eventType: 'layer_activated', layerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return result
      .filter((r) => r.layerId)
      .map((r) => ({ layerId: r.layerId as string, count: r._count.id }));
  }

  /** Repli "tendance instance" quand l'utilisateur courant n'a pas encore d'historique. */
  async getTopActivatedLayersForInstance(
    instanceId: string,
    limit: number,
  ): Promise<{ layerId: string; count: number }[]> {
    const result = await this.prisma.analyticsEvent.groupBy({
      by: ['layerId'],
      where: { instanceId, eventType: 'layer_activated', layerId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return result
      .filter((r) => r.layerId)
      .map((r) => ({ layerId: r.layerId as string, count: r._count.id }));
  }

  /**
   * Série temporelle du nombre total d'événements par jour (tableau de bord d'usage admin,
   * voir plan du 2026-08-05) - `instanceId` null = toutes instances (vue plateforme
   * SUPER_ADMIN).
   */
  async getDailyCounts(instanceId: string | null, startDate: Date): Promise<DailyCount[]> {
    const instanceFilter = instanceId
      ? Prisma.sql`AND instance_id = ${instanceId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
      FROM analytics_events
      WHERE created_at >= ${startDate}
      ${instanceFilter}
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
  }

  /** Même principe que getDailyCounts, mais utilisateurs distincts (anonymes exclus). */
  async getDailyActiveUsers(instanceId: string | null, startDate: Date): Promise<DailyCount[]> {
    const instanceFilter = instanceId
      ? Prisma.sql`AND instance_id = ${instanceId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', created_at) AS day, COUNT(DISTINCT user_id) AS count
      FROM analytics_events
      WHERE created_at >= ${startDate} AND user_id IS NOT NULL
      ${instanceFilter}
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((r) => ({ date: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
  }

  /** Variante de getAggregatedStats avec instanceId optionnel (vue plateforme globale). */
  async getEventBreakdown(
    instanceId: string | null,
    startDate: Date,
  ): Promise<AnalyticsAggregation[]> {
    const instanceFilter = instanceId
      ? Prisma.sql`AND instance_id = ${instanceId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ event_type: string; count: bigint }[]>`
      SELECT event_type, COUNT(*) AS count
      FROM analytics_events
      WHERE created_at >= ${startDate}
      ${instanceFilter}
      GROUP BY event_type
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ eventType: r.event_type, count: Number(r.count) }));
  }

  /** Détail des outils de l'agent IA réellement invoqués (event_type 'assistant_tool_used',
   * voir AssistantChatUseCase.executeDataTool), classés par fréquence. */
  async getToolUsageBreakdown(
    instanceId: string | null,
    startDate: Date,
  ): Promise<ToolUsageCount[]> {
    const instanceFilter = instanceId
      ? Prisma.sql`AND instance_id = ${instanceId}::uuid`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ tool: string | null; count: bigint }[]>`
      SELECT metadata->>'tool' AS tool, COUNT(*) AS count
      FROM analytics_events
      WHERE event_type = 'assistant_tool_used' AND created_at >= ${startDate}
      ${instanceFilter}
      GROUP BY tool
      ORDER BY count DESC
    `;
    return rows
      .filter((r) => r.tool)
      .map((r) => ({ tool: r.tool as string, count: Number(r.count) }));
  }

  /**
   * Recommandation par co-occurrence ("les utilisateurs qui ont activé X ont aussi activé
   * Y") : parmi les utilisateurs ayant activé `layerId`, quelles AUTRES couches ont-ils
   * aussi activées dans la même instance - classées par nombre d'utilisateurs distincts en
   * commun. Auto-jointure non exprimable proprement via l'API Prisma (groupBy ne supporte
   * pas les jointures), d'où le SQL brut.
   */
  async getCoActivatedLayers(
    layerId: string,
    instanceId: string,
    limit: number,
  ): Promise<{ layerId: string; coUserCount: number }[]> {
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
