import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import type { PostGISService } from '../../infrastructure/database/postgis.service.js';
import { GetLayerStatsUseCase } from '../../application/use-cases/layers/get-layer-stats.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const altitudeBodySchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const elevationProfileBodySchema = z.object({
  geometry: z.record(z.unknown()),
  numPoints: z.number().int().min(2).max(1000).default(100),
});

const layerIdParamSchema = z.object({ layerId: z.string().uuid() });

export async function geoportailRoutes(app: FastifyInstance): Promise<void> {
  const postGISService = app.diContainer.resolve<PostGISService>('postGISService');
  const getLayerStatsUseCase = app.diContainer.resolve<GetLayerStatsUseCase>('getLayerStatsUseCase');

  // POST /api/v1/geoportail/altitude
  app.post('/altitude', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lon, lat } = parseBody(altitudeBodySchema, request.body);
    const altitude = await postGISService.getAltitude(lon, lat);
    return reply.send(successResponse({ lon, lat, altitude }));
  });

  // POST /api/v1/geoportail/elevation-profile
  app.post('/elevation-profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const { geometry, numPoints } = parseBody(elevationProfileBodySchema, request.body);
    const profile = await postGISService.drapeElevationProfile(JSON.stringify(geometry), numPoints);
    return reply.send(successResponse({ profile }));
  });

  // POST /api/v1/layers/:layerId/stats
  app.post('/layers/:layerId/stats', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const stats = await getLayerStatsUseCase.execute(layerId);
    return reply.send(successResponse(stats));
  });
}
