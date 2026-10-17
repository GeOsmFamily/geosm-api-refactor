import { Prisma, type PrismaClient, type ReportReason, type ReportTargetType } from '@prisma/client';

export interface ReportSummary {
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  reasons: ReportReason[];
  lastReportedAt: Date;
}

/** Signalements generiques (ADR 0007, point 5) : publications et commentaires, puis phase 3. */
export class PrismaContentReportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Enregistre un signalement (un seul par utilisateur et par contenu) et renvoie le nombre de
   * signaleurs distincts encore en attente de moderation.
   */
  async report(data: {
    targetType: ReportTargetType;
    targetId: string;
    instanceId: string;
    reporterId: string;
    reason: ReportReason;
    details: string | null;
  }): Promise<{ created: boolean; openReports: number }> {
    let created = true;
    try {
      await this.prisma.contentReport.create({ data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        created = false;
      } else {
        throw error;
      }
    }
    const openReports = await this.prisma.contentReport.count({
      where: { targetType: data.targetType, targetId: data.targetId, resolvedAt: null },
    });
    return { created, openReports };
  }

  /** Contenus signales d'une instance, les plus signales d'abord. */
  async listOpen(instanceId: string, targetType?: ReportTargetType): Promise<ReportSummary[]> {
    const rows = await this.prisma.contentReport.findMany({
      where: { instanceId, resolvedAt: null, ...(targetType ? { targetType } : {}) },
      select: { targetType: true, targetId: true, reason: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const byTarget = new Map<string, ReportSummary>();
    for (const row of rows) {
      const key = `${row.targetType}:${row.targetId}`;
      const summary = byTarget.get(key) ?? {
        targetType: row.targetType,
        targetId: row.targetId,
        reportCount: 0,
        reasons: [],
        lastReportedAt: row.createdAt,
      };
      summary.reportCount++;
      if (!summary.reasons.includes(row.reason)) summary.reasons.push(row.reason);
      byTarget.set(key, summary);
    }
    return [...byTarget.values()].sort(
      (a, b) => b.reportCount - a.reportCount || +b.lastReportedAt - +a.lastReportedAt,
    );
  }

  resolve(targetType: ReportTargetType, targetId: string, moderatorId: string): Promise<unknown> {
    return this.prisma.contentReport.updateMany({
      where: { targetType, targetId, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedBy: moderatorId },
    });
  }
}
