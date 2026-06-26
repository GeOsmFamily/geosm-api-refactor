import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { SpatialAnalysisUseCase } from '../../application/use-cases/analysis/spatial-analysis.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const spatialAnalysisSchema = z.object({
  operation: z.enum(['buffer', 'intersection', 'union', 'difference']),
  geometryA: z.record(z.unknown()),
  geometryB: z.record(z.unknown()).optional(),
  distance: z.number().positive().optional(),
  srid: z.number().int().optional(),
});

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  const spatialAnalysisUseCase = app.diContainer.resolve<SpatialAnalysisUseCase>('spatialAnalysisUseCase');

  // POST /analysis/spatial
  app.post('/spatial', {
    schema: { description: 'Effectuer une analyse spatiale', tags: ['Analyse spatiale'], body: zodToSwagger(spatialAnalysisSchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(spatialAnalysisSchema, request.body);
    const result = await spatialAnalysisUseCase.execute(input);
    return reply.send(successResponse(result));
  });
}
