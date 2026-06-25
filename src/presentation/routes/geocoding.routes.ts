import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { searchGeocodingQuerySchema, reverseGeocodingQuerySchema, lookupGeocodingQuerySchema } from '../schemas/geocoding.schema.js';
import type { SearchGeocodingUseCase } from '../../application/use-cases/geocoding/search-geocoding.use-case.js';
import type { ReverseGeocodingUseCase } from '../../application/use-cases/geocoding/reverse-geocoding.use-case.js';
import type { LookupGeocodingUseCase } from '../../application/use-cases/geocoding/lookup-geocoding.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function geocodingRoutes(app: FastifyInstance): Promise<void> {
  const searchGeocodingUseCase = app.diContainer.resolve<SearchGeocodingUseCase>('searchGeocodingUseCase');
  const reverseGeocodingUseCase = app.diContainer.resolve<ReverseGeocodingUseCase>('reverseGeocodingUseCase');
  const lookupGeocodingUseCase = app.diContainer.resolve<LookupGeocodingUseCase>('lookupGeocodingUseCase');

  app.get('/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchGeocodingQuerySchema, request.query);
    const result = await searchGeocodingUseCase.execute(query.q, {
      viewbox: query.viewbox,
      bounded: query.bounded,
      limit: query.limit,
      countrycodes: query.countrycodes,
    });
    return reply.send(successResponse(result));
  });

  app.get('/reverse', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(reverseGeocodingQuerySchema, request.query);
    const result = await reverseGeocodingUseCase.execute(query.lat, query.lon);
    return reply.send(successResponse(result));
  });

  app.get('/lookup', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(lookupGeocodingQuerySchema, request.query);
    const osmIds = query.osm_ids.split(',');
    const result = await lookupGeocodingUseCase.execute(osmIds);
    return reply.send(successResponse(result));
  });
}
