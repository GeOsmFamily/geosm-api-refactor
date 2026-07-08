import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createBaseMapSchema, updateBaseMapSchema } from '../schemas/base-map.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListBaseMapsUseCase } from '../../application/use-cases/base-maps/list-base-maps.use-case.js';
import { CreateBaseMapUseCase } from '../../application/use-cases/base-maps/create-base-map.use-case.js';
import { UpdateBaseMapUseCase } from '../../application/use-cases/base-maps/update-base-map.use-case.js';
import { DeleteBaseMapUseCase } from '../../application/use-cases/base-maps/delete-base-map.use-case.js';

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

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const baseMapIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

export async function baseMapRoutes(app: FastifyInstance): Promise<void> {
  const listBaseMapsUseCase = app.diContainer.resolve<ListBaseMapsUseCase>('listBaseMapsUseCase');
  const createBaseMapUseCase =
    app.diContainer.resolve<CreateBaseMapUseCase>('createBaseMapUseCase');
  const updateBaseMapUseCase =
    app.diContainer.resolve<UpdateBaseMapUseCase>('updateBaseMapUseCase');
  const deleteBaseMapUseCase =
    app.diContainer.resolve<DeleteBaseMapUseCase>('deleteBaseMapUseCase');

  app.get(
    '/',
    {
      schema: { description: "Lister les fonds de carte d'une instance", tags: ['Fonds de carte'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const result = await listBaseMapsUseCase.execute(instanceId);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/',
    {
      schema: {
        description: 'Creer un fond de carte',
        tags: ['Fonds de carte'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createBaseMapSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(createBaseMapSchema, request.body);
      const result = await createBaseMapUseCase.execute(instanceId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        description: 'Modifier un fond de carte',
        tags: ['Fonds de carte'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateBaseMapSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(baseMapIdParamSchema, request.params);
      const dto = parseBody(updateBaseMapSchema, request.body);
      const result = await updateBaseMapUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un fond de carte',
        tags: ['Fonds de carte'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(baseMapIdParamSchema, request.params);
      await deleteBaseMapUseCase.execute(id);
      return reply.send(successResponse(null));
    },
  );
}
