import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  createLayerGroupSchema,
  updateLayerGroupSchema,
  reorderLayerGroupsSchema,
} from '../schemas/layer-group.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { localizeEntity, localizeEntities } from '../../application/utils/localize.js';
import { resolveLang } from '../utils/lang.util.js';

import { ListLayerGroupsUseCase } from '../../application/use-cases/layer-groups/list-layer-groups.use-case.js';
import { GetLayerGroupUseCase } from '../../application/use-cases/layer-groups/get-layer-group.use-case.js';
import { CreateLayerGroupUseCase } from '../../application/use-cases/layer-groups/create-layer-group.use-case.js';
import { UpdateLayerGroupUseCase } from '../../application/use-cases/layer-groups/update-layer-group.use-case.js';
import { DeleteLayerGroupUseCase } from '../../application/use-cases/layer-groups/delete-layer-group.use-case.js';
import { ReorderLayerGroupsUseCase } from '../../application/use-cases/layer-groups/reorder-layer-groups.use-case.js';

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
const groupIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

export async function layerGroupRoutes(app: FastifyInstance): Promise<void> {
  const listLayerGroupsUseCase = app.diContainer.resolve<ListLayerGroupsUseCase>('listLayerGroupsUseCase');
  const getLayerGroupUseCase = app.diContainer.resolve<GetLayerGroupUseCase>('getLayerGroupUseCase');
  const createLayerGroupUseCase = app.diContainer.resolve<CreateLayerGroupUseCase>('createLayerGroupUseCase');
  const updateLayerGroupUseCase = app.diContainer.resolve<UpdateLayerGroupUseCase>('updateLayerGroupUseCase');
  const deleteLayerGroupUseCase = app.diContainer.resolve<DeleteLayerGroupUseCase>('deleteLayerGroupUseCase');
  const reorderLayerGroupsUseCase =
    app.diContainer.resolve<ReorderLayerGroupsUseCase>('reorderLayerGroupsUseCase');

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les groupes',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const result = await listLayerGroupsUseCase.execute(instanceId);
      return reply.send(successResponse(localizeEntities(result, resolveLang(request))));
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: 'Obtenir un groupe par ID',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(groupIdParamSchema, request.params);
      const result = await getLayerGroupUseCase.execute(id);
      return reply.send(successResponse(localizeEntity(result, resolveLang(request))));
    },
  );

  app.post(
    '/',
    {
      schema: {
        description: 'Créer un groupe',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createLayerGroupSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const dto = parseBody(createLayerGroupSchema, request.body);
      const result = await createLayerGroupUseCase.execute(instanceId, dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        description: 'Mettre à jour un groupe',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateLayerGroupSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(groupIdParamSchema, request.params);
      const dto = parseBody(updateLayerGroupSchema, request.body);
      const result = await updateLayerGroupUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un groupe',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(groupIdParamSchema, request.params);
      await deleteLayerGroupUseCase.execute(id);
      return reply.send(successResponse(null));
    },
  );

  app.patch(
    '/reorder',
    {
      schema: {
        description: 'Réordonner les groupes',
        tags: ['LayerGroupes'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(reorderLayerGroupsSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(reorderLayerGroupsSchema, request.body);
      await reorderLayerGroupsUseCase.execute(dto);
      return reply.send(successResponse(null));
    },
  );
}
