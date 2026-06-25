import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { globalSearchQuerySchema, searchLayersQuerySchema, searchFeaturesQuerySchema } from '../schemas/search.schema.js';
import type { GlobalSearchUseCase } from '../../application/use-cases/search/global-search.use-case.js';
import type { SearchLayersUseCase } from '../../application/use-cases/search/search-layers.use-case.js';
import type { SearchFeaturesUseCase } from '../../application/use-cases/search/search-features.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  const globalSearchUseCase = app.diContainer.resolve<GlobalSearchUseCase>('globalSearchUseCase');
  const searchLayersUseCase = app.diContainer.resolve<SearchLayersUseCase>('searchLayersUseCase');
  const searchFeaturesUseCase = app.diContainer.resolve<SearchFeaturesUseCase>('searchFeaturesUseCase');

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(globalSearchQuerySchema, request.query);
    const result = await globalSearchUseCase.execute(query.q, query.limit);
    return reply.send(successResponse(result));
  });

  app.get('/layers', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchLayersQuerySchema, request.query);
    const result = await searchLayersUseCase.execute(query.q, {
      instanceId: query.instanceId,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.send(successResponse(result));
  });

  app.get('/features', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchFeaturesQuerySchema, request.query);
    const result = await searchFeaturesUseCase.execute(query.q, {
      layerId: query.layerId,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.send(successResponse(result));
  });
}
