import type { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface AnalysisReportDTO {
  id: string;
  topic: string;
  layerIds: string[];
  status: string;
  resultJson: unknown;
  filePath: string | null;
  fileSize: number | null;
  errorMessage: string | null;
  rating: number | null;
  ratingComment: string | null;
}

/** Lecture du statut/résultat d'un rapport d'analyse - consommé en polling par le frontend
 * (voir plan "refonte Statistiques" du 2026-08-05), même principe que
 * GetRasterAnalysisResultUseCase/GetLocationPlanUseCase. */
export class GetAnalysisReportUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(id: string): Promise<AnalysisReportDTO> {
    const row = await this.prisma.analysisReport.findUnique({ where: { id } });
    if (!row) throw new NotFoundError('AnalysisReport', id);
    return {
      id: row.id,
      topic: row.topic,
      layerIds: row.layerIds,
      status: row.status,
      resultJson: row.resultJson,
      filePath: row.filePath,
      fileSize: row.fileSize,
      errorMessage: row.errorMessage,
      rating: row.rating,
      ratingComment: row.ratingComment,
    };
  }
}
