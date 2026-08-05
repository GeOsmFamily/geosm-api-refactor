import type { PrismaClient } from '@prisma/client';
import type { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GenerateAnalysisReportUseCase');

export interface GenerateAnalysisReportResult {
  reportId: string;
}

/**
 * Déclenche la génération asynchrone d'un rapport d'analyse IA en PDF (voir plan "refonte
 * Statistiques" du 2026-08-05) - même structure que RunRasterAnalysisUseCase/
 * CreateLocationPlanUseCase : crée la ligne de suivi (status PENDING) puis pousse le job dans
 * la queue dédiée, le worker (analysis-report.worker.ts) fait le vrai travail.
 */
export class GenerateAnalysisReportUseCase {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queueService: QueueService,
  ) {}

  async execute(
    userId: string,
    instanceId: string,
    topic: string,
    layerIds: string[],
    extent?: [number, number, number, number],
    geometry?: Record<string, unknown>,
  ): Promise<GenerateAnalysisReportResult> {
    if (!topic.trim()) throw new ValidationError('Le sujet du rapport est requis', {});
    if (layerIds.length === 0) {
      throw new ValidationError('Au moins une couche est requise pour générer un rapport', {});
    }

    const created = await this.prisma.analysisReport.create({
      data: { userId, instanceId, topic, layerIds, status: 'PENDING' },
    });

    await this.queueService.addJob('analysis-report', 'generate', {
      reportId: created.id,
      userId,
      instanceId,
      topic,
      layerIds,
      extent,
      geometry,
    });

    logger.info("Job de génération de rapport d'analyse mis en file", {
      reportId: created.id,
      topic,
      layerIds,
    });
    return { reportId: created.id };
  }
}
