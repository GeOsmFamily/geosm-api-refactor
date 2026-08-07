import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { GetLiveLayerDataUseCase } from '../../application/use-cases/layers/get-live-layer-data.use-case.js';

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

/**
 * Proxy+cache d'une couche vivante (capteur externe) - route publique, même donnée
 * géographique en lecture seule que /layers/:layerId/features (voir ce fichier pour le
 * raisonnement complet sur l'absence d'authentification).
 */
export async function liveLayerRoutes(app: FastifyInstance): Promise<void> {
  const getLiveLayerDataUseCase = app.diContainer.resolve<GetLiveLayerDataUseCase>(
    'getLiveLayerDataUseCase',
  );

  app.get(
    '/',
    {
      schema: {
        description: "Récupérer les données courantes d'une couche vivante (mises en cache)",
        tags: ['Couches vivantes'],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { layerId } = parseBody(layerIdParamSchema, request.params);
      const result = await getLiveLayerDataUseCase.execute(layerId);
      return reply.send(successResponse(result));
    },
  );
}
