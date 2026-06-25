import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createGroupSchema, updateGroupSchema, reorderGroupsSchema } from '../schemas/group.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListGroupsUseCase } from '../../application/use-cases/groups/list-groups.use-case.js';
import { GetGroupUseCase } from '../../application/use-cases/groups/get-group.use-case.js';
import { CreateGroupUseCase } from '../../application/use-cases/groups/create-group.use-case.js';
import { UpdateGroupUseCase } from '../../application/use-cases/groups/update-group.use-case.js';
import { DeleteGroupUseCase } from '../../application/use-cases/groups/delete-group.use-case.js';
import { ReorderGroupsUseCase } from '../../application/use-cases/groups/reorder-groups.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const groupIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

export async function groupRoutes(app: FastifyInstance): Promise<void> {
  const listGroupsUseCase = app.diContainer.resolve<ListGroupsUseCase>('listGroupsUseCase');
  const getGroupUseCase = app.diContainer.resolve<GetGroupUseCase>('getGroupUseCase');
  const createGroupUseCase = app.diContainer.resolve<CreateGroupUseCase>('createGroupUseCase');
  const updateGroupUseCase = app.diContainer.resolve<UpdateGroupUseCase>('updateGroupUseCase');
  const deleteGroupUseCase = app.diContainer.resolve<DeleteGroupUseCase>('deleteGroupUseCase');
  const reorderGroupsUseCase = app.diContainer.resolve<ReorderGroupsUseCase>('reorderGroupsUseCase');

  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await listGroupsUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(groupIdParamSchema, request.params);
    const result = await getGroupUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  app.post('/', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const dto = parseBody(createGroupSchema, request.body);
    const result = await createGroupUseCase.execute(instanceId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.patch('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(groupIdParamSchema, request.params);
    const dto = parseBody(updateGroupSchema, request.body);
    const result = await updateGroupUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  app.delete('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(groupIdParamSchema, request.params);
    await deleteGroupUseCase.execute(id);
    return reply.send(successResponse(null));
  });

  app.patch('/reorder', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(reorderGroupsSchema, request.body);
    await reorderGroupsUseCase.execute(dto);
    return reply.send(successResponse(null));
  });
}
