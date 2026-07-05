import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { routeQuerySchema, nearestQuerySchema, nearestFeatureQuerySchema } from '../schemas/routing.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import type { CalculateRouteUseCase } from '../../application/use-cases/routing/calculate-route.use-case.js';
import type { FindNearestUseCase } from '../../application/use-cases/routing/find-nearest.use-case.js';
import type { FindNearestFeatureUseCase } from '../../application/use-cases/routing/find-nearest-feature.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function routingRoutes(app: FastifyInstance): Promise<void> {
  const calculateRouteUseCase = app.diContainer.resolve<CalculateRouteUseCase>('calculateRouteUseCase');
  const findNearestUseCase = app.diContainer.resolve<FindNearestUseCase>('findNearestUseCase');
  const findNearestFeatureUseCase = app.diContainer.resolve<FindNearestFeatureUseCase>('findNearestFeatureUseCase');

  app.get('/route', {
    schema: { description: 'Calculer un itineraire', tags: ['Itineraire'], querystring: zodToSwagger(routeQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
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

  app.get('/nearest', {
    schema: { description: 'Trouver le point le plus proche', tags: ['Itineraire'], querystring: zodToSwagger(nearestQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(nearestQuerySchema, request.query);
    const result = await findNearestUseCase.execute(query.lon, query.lat, query.number);
    return reply.send(successResponse(result));
  });

  // GET /api/v1/routing/nearest-feature?layerId=&lon=&lat=&limit=
  // Trouve les N features d'une couche les plus proches d'un point, classées par distance
  // ROUTIÈRE réelle (OSRM) plutôt qu'à vol d'oiseau - ex. "l'hôpital le plus proche d'ici".
  app.get('/nearest-feature', {
    schema: { description: 'Trouver les features d\'une couche les plus proches d\'un point (distance routière)', tags: ['Itineraire'], querystring: zodToSwagger(nearestFeatureQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(nearestFeatureQuerySchema, request.query);
    const result = await findNearestFeatureUseCase.execute(query.layerId, query.lon, query.lat, query.limit);
    return reply.send(successResponse(result));
  });
}
