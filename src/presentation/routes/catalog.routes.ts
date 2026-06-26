import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { GetCatalogUseCase } from '../../application/use-cases/catalog/get-catalog.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceSlugParamSchema = z.object({ instanceSlug: z.string().min(1) });

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  const getCatalogUseCase = app.diContainer.resolve<GetCatalogUseCase>('getCatalogUseCase');

  // GET /api/v1/catalog
  app.get('/', {
    schema: { description: 'Obtenir le catalogue complet', tags: ['Catalogue'] },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const catalog = await getCatalogUseCase.execute();
    return reply.send(successResponse(catalog));
  });

  // GET /api/v1/catalog/:instanceSlug
  app.get('/:instanceSlug', {
    schema: { description: 'Obtenir le catalogue par instance', tags: ['Catalogue'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceSlug } = parseBody(instanceSlugParamSchema, request.params);
    const catalog = await getCatalogUseCase.execute(instanceSlug);
    return reply.send(successResponse(catalog));
  });
}
