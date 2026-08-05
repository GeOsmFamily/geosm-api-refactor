import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { GenerateAnalysisReportUseCase } from '../../application/use-cases/reports/generate-analysis-report.use-case.js';
import { GetAnalysisReportUseCase } from '../../application/use-cases/reports/get-analysis-report.use-case.js';
import type { MinioStorageService } from '../../infrastructure/storage/minio.service.js';

function parseBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ValidationError(
      'Validation failed',
      result.error?.format() as Record<string, unknown>,
    );
  return result.data as T;
}

const idParamSchema = z.object({ id: z.string().uuid() });

const generateReportBodySchema = z.object({
  instanceId: z.string().uuid(),
  topic: z.string().min(1).max(200),
  layerIds: z.array(z.string().uuid()).min(1).max(20),
  extent: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  geometry: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Rapports d'analyse IA en PDF (voir plan "refonte Statistiques" du 2026-08-05) - même pattern
 * que location-plan.routes.ts (génération asynchrone BullMQ + proxy de téléchargement MinIO),
 * déclenchable depuis l'outil `generate_analysis_report` de l'assistant IA ou directement via
 * cette API.
 */
export async function analysisReportRoutes(app: FastifyInstance): Promise<void> {
  const generateAnalysisReportUseCase = app.diContainer.resolve<GenerateAnalysisReportUseCase>(
    'generateAnalysisReportUseCase',
  );
  const getAnalysisReportUseCase =
    app.diContainer.resolve<GetAnalysisReportUseCase>('getAnalysisReportUseCase');
  const storageService = app.diContainer.resolve<MinioStorageService>('storageService');

  app.post(
    '/',
    {
      schema: {
        description: "Générer un rapport d'analyse IA (PDF, job asynchrone)",
        tags: ["Rapports d'analyse"],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(generateReportBodySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId, topic, layerIds, extent, geometry } = parseBody(
        generateReportBodySchema,
        request.body,
      );
      const userId = request.user!.sub;
      const result = await generateAnalysisReportUseCase.execute(
        userId,
        instanceId,
        topic,
        layerIds,
        extent,
        geometry,
      );
      return reply.status(202).send(successResponse(result));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: "Obtenir le statut/résultat d'un rapport d'analyse",
        tags: ["Rapports d'analyse"],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await getAnalysisReportUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  app.get(
    '/:id/download',
    {
      schema: {
        description: "Télécharger le PDF d'un rapport d'analyse",
        tags: ["Rapports d'analyse"],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await getAnalysisReportUseCase.execute(id);
      if (!result.filePath) {
        throw new ValidationError('Analysis report not ready for download', {
          status: result.status,
        });
      }
      const stream = await storageService.downloadFile(result.filePath);
      const fileName = result.filePath.split('/').pop() || `rapport-${id}.pdf`;
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Type', 'application/pdf');
      return reply.send(stream);
    },
  );
}
