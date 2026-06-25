import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { GetQgisProjectUseCase } from '../../application/use-cases/qgis-projects/get-qgis-project.use-case.js';
import { ReloadQgisProjectUseCase } from '../../application/use-cases/qgis-projects/reload-qgis-project.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });

export async function qgisProjectRoutes(app: FastifyInstance): Promise<void> {
  const getQgisProjectUseCase = app.diContainer.resolve<GetQgisProjectUseCase>('getQgisProjectUseCase');
  const reloadQgisProjectUseCase = app.diContainer.resolve<ReloadQgisProjectUseCase>('reloadQgisProjectUseCase');

  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await getQgisProjectUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  app.post('/reload', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await reloadQgisProjectUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });
}
