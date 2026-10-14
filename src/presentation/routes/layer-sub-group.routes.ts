import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createLayerSubGroupSchema, updateLayerSubGroupSchema } from '../schemas/layer-sub-group.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { localizeEntity, localizeEntities } from '../../application/utils/localize.js';
import { resolveLang } from '../utils/lang.util.js';

import { ListLayerSubGroupsUseCase } from '../../application/use-cases/layer-sub-groups/list-layer-sub-groups.use-case.js';
import { GetLayerSubGroupUseCase } from '../../application/use-cases/layer-sub-groups/get-layer-sub-group.use-case.js';
import { CreateLayerSubGroupUseCase } from '../../application/use-cases/layer-sub-groups/create-layer-sub-group.use-case.js';
import { UpdateLayerSubGroupUseCase } from '../../application/use-cases/layer-sub-groups/update-layer-sub-group.use-case.js';
import { DeleteLayerSubGroupUseCase } from '../../application/use-cases/layer-sub-groups/delete-layer-sub-group.use-case.js';

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

const groupIdParamSchema = z.object({ groupId: z.string().uuid() });
const layerSubGroupIdParamSchema = z.object({ groupId: z.string().uuid(), id: z.string().uuid() });

export async function layerSubGroupRoutes(app: FastifyInstance): Promise<void> {
  const listLayerSubGroupsUseCase =
    app.diContainer.resolve<ListLayerSubGroupsUseCase>('listLayerSubGroupsUseCase');
  const getLayerSubGroupUseCase = app.diContainer.resolve<GetLayerSubGroupUseCase>('getLayerSubGroupUseCase');
  const createLayerSubGroupUseCase =
    app.diContainer.resolve<CreateLayerSubGroupUseCase>('createLayerSubGroupUseCase');
  const updateLayerSubGroupUseCase =
    app.diContainer.resolve<UpdateLayerSubGroupUseCase>('updateLayerSubGroupUseCase');
  const deleteLayerSubGroupUseCase =
    app.diContainer.resolve<DeleteLayerSubGroupUseCase>('deleteLayerSubGroupUseCase');

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les sous-groupes',
        tags: ['Sous-groupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { groupId } = parseBody(groupIdParamSchema, request.params);
      const result = await listLayerSubGroupsUseCase.execute(groupId);
      return reply.send(successResponse(localizeEntities(result, resolveLang(request))));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: 'Obtenir un sous-groupe par ID',
        tags: ['Sous-groupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerSubGroupIdParamSchema, request.params);
      const result = await getLayerSubGroupUseCase.execute(id);
      return reply.send(successResponse(localizeEntity(result, resolveLang(request))));
    },
  );

  app.post(
    '/',
    {
      schema: {
        description: 'Créer un sous-groupe',
        tags: ['Sous-groupes'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createLayerSubGroupSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { groupId } = parseBody(groupIdParamSchema, request.params);
      const dto = parseBody(createLayerSubGroupSchema, request.body);
      const result = await createLayerSubGroupUseCase.execute(groupId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        description: 'Mettre à jour un sous-groupe',
        tags: ['Sous-groupes'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateLayerSubGroupSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerSubGroupIdParamSchema, request.params);
      const dto = parseBody(updateLayerSubGroupSchema, request.body);
      const result = await updateLayerSubGroupUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un sous-groupe',
        tags: ['Sous-groupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(layerSubGroupIdParamSchema, request.params);
      await deleteLayerSubGroupUseCase.execute(id);
      return reply.send(successResponse(null));
    },
  );
}
