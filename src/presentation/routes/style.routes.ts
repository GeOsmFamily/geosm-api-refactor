import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { layerIdParamSchema, updateSldSchema, updateMapboxSchema } from '../schemas/style.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { GetLayerStyleUseCase } from '../../application/use-cases/styles/get-layer-style.use-case.js';
import { UpdateLayerStyleUseCase } from '../../application/use-cases/styles/update-layer-style.use-case.js';
import { ResetLayerStyleUseCase } from '../../application/use-cases/styles/reset-layer-style.use-case.js';
import { ListDefaultStylesUseCase } from '../../application/use-cases/styles/list-default-styles.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function styleRoutes(app: FastifyInstance): Promise<void> {
  const getLayerStyleUseCase = app.diContainer.resolve<GetLayerStyleUseCase>('getLayerStyleUseCase');
  const updateLayerStyleUseCase = app.diContainer.resolve<UpdateLayerStyleUseCase>('updateLayerStyleUseCase');
  const resetLayerStyleUseCase = app.diContainer.resolve<ResetLayerStyleUseCase>('resetLayerStyleUseCase');
  const listDefaultStylesUseCase = app.diContainer.resolve<ListDefaultStylesUseCase>('listDefaultStylesUseCase');

  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const result = await getLayerStyleUseCase.execute(layerId);
    return reply.send(successResponse(result));
  });

  app.put('/sld', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const dto = parseBody(updateSldSchema, request.body);
    const styles = await getLayerStyleUseCase.execute(layerId);
    if (styles.length === 0) {
      return reply.status(404).send({ success: false, message: 'No styles found for this layer' });
    }
    const result = await updateLayerStyleUseCase.execute(styles[0].id, { sldBody: dto.sldBody });
    return reply.send(successResponse(result));
  });

  app.put('/mapbox', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    const dto = parseBody(updateMapboxSchema, request.body);
    const styles = await getLayerStyleUseCase.execute(layerId);
    if (styles.length === 0) {
      return reply.status(404).send({ success: false, message: 'No styles found for this layer' });
    }
    const result = await updateLayerStyleUseCase.execute(styles[0].id, { mapboxStyle: dto.mapboxStyle });
    return reply.send(successResponse(result));
  });

  app.post('/reset', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { layerId } = parseBody(layerIdParamSchema, request.params);
    await resetLayerStyleUseCase.execute(layerId);
    return reply.send(successResponse(null));
  });

  app.get('/defaults', { preHandler: [app.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listDefaultStylesUseCase.execute();
    return reply.send(successResponse(result));
  });
}
