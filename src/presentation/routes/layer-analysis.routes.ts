import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { GetChoroplethStatsUseCase } from '../../application/use-cases/geoportail/get-choropleth-stats.use-case.js';
import { GetGridStatsUseCase } from '../../application/use-cases/geoportail/get-grid-stats.use-case.js';

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

const layerIdParamSchema = z.object({ layerId: z.string().uuid() });

const choroplethQuerySchema = z.object({
  attribute: z.string().min(1),
  adminLevel: z.coerce.number().int(),
});

const gridQuerySchema = z.object({
  bbox: z.string().transform((v, ctx) => {
    const parts = v.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      ctx.addIssue({ code: 'custom', message: 'bbox invalide, attendu "minLon,minLat,maxLon,maxLat"' });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  }),
  cellSizeMeters: z.coerce.number().positive(),
  gridType: z.enum(['square', 'hexagon']).default('square'),
});

/**
 * Statistiques spatiales dérivées d'une couche vectorielle (choroplèthe + carroyage, voir plan
 * "Choroplèthes + Carroyage" du 2026-08-06) - routes publiques, même donnée géographique en
 * lecture seule que /layers/:layerId/features (voir ce fichier pour le raisonnement complet).
 */
export async function layerAnalysisRoutes(app: FastifyInstance): Promise<void> {
  const getChoroplethStatsUseCase = app.diContainer.resolve<GetChoroplethStatsUseCase>(
    'getChoroplethStatsUseCase',
  );
  const getGridStatsUseCase =
    app.diContainer.resolve<GetGridStatsUseCase>('getGridStatsUseCase');

  // GET /api/v1/layers/:layerId/analysis/choropleth?attribute=X&adminLevel=N
  app.get(
    '/choropleth',
    {
      schema: {
        description: "Agréger un attribut numérique d'une couche par zone administrative",
        tags: ['Statistiques'],
        querystring: zodToSwagger(choroplethQuerySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(layerIdParamSchema, request.params);
      const { attribute, adminLevel } = parseBody(choroplethQuerySchema, request.query);
      const result = await getChoroplethStatsUseCase.execute(layerId, attribute, adminLevel);
      return reply.send(successResponse(result));
    },
  );

  // GET /api/v1/layers/:layerId/analysis/grid?bbox=...&cellSizeMeters=500&gridType=square
  app.get(
    '/grid',
    {
      schema: {
        description: "Générer une grille statistique (carroyage/hexbin) sur l'emprise donnée",
        tags: ['Statistiques'],
        querystring: zodToSwagger(gridQuerySchema),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(layerIdParamSchema, request.params);
      const { bbox, cellSizeMeters, gridType } = parseBody(gridQuerySchema, request.query);
      const result = await getGridStatsUseCase.execute(layerId, bbox, cellSizeMeters, gridType);
      return reply.send(successResponse(result));
    },
  );
}
