import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { routeQuerySchema, nearestQuerySchema } from '../schemas/routing.schema.js';
import type { CalculateRouteUseCase } from '../../application/use-cases/routing/calculate-route.use-case.js';
import type { FindNearestUseCase } from '../../application/use-cases/routing/find-nearest.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function routingRoutes(app: FastifyInstance): Promise<void> {
  const calculateRouteUseCase = app.diContainer.resolve<CalculateRouteUseCase>('calculateRouteUseCase');
  const findNearestUseCase = app.diContainer.resolve<FindNearestUseCase>('findNearestUseCase');

  app.get('/route', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(routeQuerySchema, request.query);
    const coordinates = query.coordinates.split(';').map(pair => {
      const [lon, lat] = pair.split(',').map(Number);
      return [lon, lat] as [number, number];
    });
    const result = await calculateRouteUseCase.execute(coordinates, query.profile, {
      alternatives: query.alternatives,
      steps: query.steps,
      geometries: query.geometries,
    });
    return reply.send(successResponse(result));
  });

  app.get('/nearest', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(nearestQuerySchema, request.query);
    const result = await findNearestUseCase.execute(query.lon, query.lat, query.number);
    return reply.send(successResponse(result));
  });
}
