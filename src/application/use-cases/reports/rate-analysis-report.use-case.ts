import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';

export interface RateAnalysisReportInput {
  userId: string;
  reportId: string;
  rating: 1 | -1;
  ratingComment?: string;
}

/** Retour qualité sur un rapport IA (voir plan "Gouvernance citoyenne & qualité IA" du
 * 2026-08-06) - directement sur AnalysisReport plutôt que via FeedbackSubmission, qui n'a
 * aucune FK vers une entité cible. Vérifie l'appartenance (idiome de
 * GetPersonalLayerFeaturesUseCase) : seul l'auteur du rapport peut le noter, pas n'importe quel
 * utilisateur authentifié. */
export class RateAnalysisReportUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(input: RateAnalysisReportInput): Promise<void> {
    if (input.rating !== 1 && input.rating !== -1) {
      throw new ValidationError('La note doit être 1 (utile) ou -1 (pas utile).', {});
    }
    const report = await this.prisma.analysisReport.findUnique({ where: { id: input.reportId } });
    if (!report) throw new NotFoundError('AnalysisReport', input.reportId);
    if (report.userId !== input.userId) {
      throw new ForbiddenError('Ce rapport ne vous appartient pas.');
    }

    await this.prisma.analysisReport.update({
      where: { id: input.reportId },
      data: {
        rating: input.rating,
        ratingComment: input.ratingComment ?? null,
        ratedAt: new Date(),
      },
    });
  }
}
