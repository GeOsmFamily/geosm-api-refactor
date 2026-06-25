import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { SpatialAnalysisUseCase } from '../../application/use-cases/analysis/spatial-analysis.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const spatialAnalysisSchema = z.object({
  operation: z.enum(['buffer', 'intersection', 'union', 'difference']),
  geometryA: z.string().min(1),
  geometryB: z.string().optional(),
  distance: z.number().positive().optional(),
  srid: z.number().int().optional(),
});

export async function analysisRoutes(app: FastifyInstance): Promise<void> {
  const spatialAnalysisUseCase = app.diContainer.resolve<SpatialAnalysisUseCase>('spatialAnalysisUseCase');

  // POST /analysis/spatial
  app.post('/spatial', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(spatialAnalysisSchema, request.body);
    const result = await spatialAnalysisUseCase.execute(input);
    return reply.send(successResponse(result));
  });
}
