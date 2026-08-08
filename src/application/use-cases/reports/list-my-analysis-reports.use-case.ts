import type { PrismaClient } from '@prisma/client';

export interface AnalysisReportSummaryDTO {
  id: string;
  topic: string;
  status: string;
  fileSize: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Historique des rapports d'analyse IA de l'utilisateur courant - jusqu'ici seul le tiroir de
 * tâches (poussé en temps réel par WebSocket) permettait de les retrouver, donc tout rapport
 * généré pendant une coupure de la connexion WebSocket restait invisible bien que terminé avec
 * succès côté serveur (bug réel constaté en prod le 2026-08-07). Cette liste est la source de
 * vérité persistée, indépendante de la connexion temps réel. */
export class ListMyAnalysisReportsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(userId: string, limit = 20): Promise<AnalysisReportSummaryDTO[]> {
    const rows = await this.prisma.analysisReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        topic: true,
        status: true,
        fileSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows;
  }
}
