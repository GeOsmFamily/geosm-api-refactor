import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createLocationPlanSchema,
  locationPlanIdParamSchema,
} from '../schemas/location-plan.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { CreateLocationPlanUseCase } from '../../application/use-cases/location-plans/create-location-plan.use-case.js';
import { GetLocationPlanUseCase } from '../../application/use-cases/location-plans/get-location-plan.use-case.js';
import type { MinioStorageService } from '../../infrastructure/storage/minio.service.js';
import { resolveLang } from '../utils/lang.util.js';

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

export async function locationPlanRoutes(app: FastifyInstance): Promise<void> {
  const createLocationPlanUseCase = app.diContainer.resolve<CreateLocationPlanUseCase>(
    'createLocationPlanUseCase',
  );
  const getLocationPlanUseCase =
    app.diContainer.resolve<GetLocationPlanUseCase>('getLocationPlanUseCase');
  const storageService = app.diContainer.resolve<MinioStorageService>('storageService');

  app.post(
    '/',
    {
      schema: {
        description: 'Générer un plan de localisation (QGIS)',
        tags: ['Plans de localisation'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createLocationPlanSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(createLocationPlanSchema, request.body);
      const userId = request.user!.sub;
      const result = await createLocationPlanUseCase.execute(userId, dto, resolveLang(request));
      return reply.status(201).send(successResponse(result));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: 'Obtenir le statut d’un plan de localisation',
        tags: ['Plans de localisation'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(locationPlanIdParamSchema, request.params);
      const result = await getLocationPlanUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  app.get(
    '/:id/download',
    {
      schema: {
        description: 'Télécharger le PDF du plan de localisation',
        tags: ['Plans de localisation'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(locationPlanIdParamSchema, request.params);
      const result = await getLocationPlanUseCase.execute(id);
      if (!result.filePath) {
        throw new ValidationError('Location plan not ready for download', {
          status: result.status,
        });
      }
      // Même raison que pour les exports : MinIO n'est pas joignable depuis le navigateur,
      // le flux est donc proxyfié via l'API (cf. export.routes.ts).
      const stream = await storageService.downloadFile(result.filePath);
      const fileName = result.filePath.split('/').pop() || `plan-localisation-${id}.pdf`;
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Type', 'application/pdf');
      return reply.send(stream);
    },
  );
}
