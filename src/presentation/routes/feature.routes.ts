import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { GetFeaturesUseCase } from '../../application/use-cases/features/get-features.use-case.js';
import { GetFeatureUseCase } from '../../application/use-cases/features/get-feature.use-case.js';
import { AddFeatureUseCase } from '../../application/use-cases/features/add-feature.use-case.js';
import { UpdateFeatureUseCase } from '../../application/use-cases/features/update-feature.use-case.js';
import { DeleteFeatureUseCase } from '../../application/use-cases/features/delete-feature.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const layerIdParamSchema = z.object({ layerId: z.string().uuid() });
const featureIdParamSchema = z.object({ layerId: z.string().uuid(), featureId: z.coerce.number().int() });

const getFeaturesQuerySchema = z.object({
  bbox: z.string().optional().transform(v => {
    if (!v) return undefined;
    const parts = v.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return undefined;
    return parts as unknown as [number, number, number, number];
  }),
  limit: z.coerce.number().int().min(1).max(10000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const addFeatureBodySchema = z.object({
  geometry: z.record(z.unknown()),
  properties: z.record(z.unknown()).default({}),
});

const updateFeatureBodySchema = z.object({
  geometry: z.record(z.unknown()).optional(),
  properties: z.record(z.unknown()).optional(),
});

export async function featureRoutes(app: FastifyInstance): Promise<void> {
  const getFeaturesUseCase = app.diContainer.resolve<GetFeaturesUseCase>('getFeaturesUseCase');
  const getFeatureUseCase = app.diContainer.resolve<GetFeatureUseCase>('getFeatureUseCase');
  const addFeatureUseCase = app.diContainer.resolve<AddFeatureUseCase>('addFeatureUseCase');
  const updateFeatureUseCase = app.diContainer.resolve<UpdateFeatureUseCase>('updateFeatureUseCase');
  const deleteFeatureUseCase = app.diContainer.resolve<DeleteFeatureUseCase>('deleteFeatureUseCase');

  // GET /api/v1/layers/:layerId/features
  // Route publique : ce sont les mêmes données géographiques en lecture seule que celles
  // déjà exposées sans authentification via WMS/GetFeatureInfo (QGIS Server) et le
  // catalogue. Nécessaire notamment pour que les liens de partage (/share/:code) restent
  // consultables par un visiteur non connecté - seules les mutations restent protégées.
  app.get('/', {
    schema: { description: 'Lister les features d\'une couche', tags: ['Features'], querystring: zodToSwagger(getFeaturesQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const query = parseBody(getFeaturesQuerySchema, request.query);
    const result = await getFeaturesUseCase.execute({
      layerId,
      bbox: query.bbox,
      limit: query.limit,
      offset: query.offset,
    });
    return reply.send(successResponse(result));
  });

  // GET /api/v1/layers/:layerId/features/:featureId - route publique, voir commentaire ci-dessus.
  app.get('/:featureId', {
    schema: { description: 'Obtenir une feature par ID', tags: ['Features'] },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId, featureId } = parseBody(featureIdParamSchema, request.params);
    const result = await getFeatureUseCase.execute(layerId, featureId);
    return reply.send(successResponse(result));
  });

  // POST /api/v1/layers/:layerId/features
  app.post('/', {
    schema: { description: 'Ajouter une feature', tags: ['Features'], security: [{ bearerAuth: [] }], body: zodToSwagger(addFeatureBodySchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const body = parseBody(addFeatureBodySchema, request.body);
    const result = await addFeatureUseCase.execute({
      layerId,
      geometry: body.geometry,
      properties: body.properties,
    });
    return reply.status(201).send(successResponse(result));
  });

  // PATCH /api/v1/layers/:layerId/features/:featureId
  app.patch('/:featureId', {
    schema: { description: 'Mettre à jour une feature', tags: ['Features'], security: [{ bearerAuth: [] }], body: zodToSwagger(updateFeatureBodySchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId, featureId } = parseBody(featureIdParamSchema, request.params);
    const body = parseBody(updateFeatureBodySchema, request.body);
    await updateFeatureUseCase.execute({
      layerId,
      featureId,
      geometry: body.geometry,
      properties: body.properties,
    });
    return reply.send(successResponse(null));
  });

  // DELETE /api/v1/layers/:layerId/features/:featureId
  app.delete('/:featureId', {
    schema: { description: 'Supprimer une feature', tags: ['Features'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId, featureId } = parseBody(featureIdParamSchema, request.params);
    await deleteFeatureUseCase.execute(layerId, featureId);
    return reply.send(successResponse(null));
  });
}
