import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSubGroupSchema, updateSubGroupSchema } from '../schemas/sub-group.schema.js';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListSubGroupsUseCase } from '../../application/use-cases/sub-groups/list-sub-groups.use-case.js';
import { GetSubGroupUseCase } from '../../application/use-cases/sub-groups/get-sub-group.use-case.js';
import { CreateSubGroupUseCase } from '../../application/use-cases/sub-groups/create-sub-group.use-case.js';
import { UpdateSubGroupUseCase } from '../../application/use-cases/sub-groups/update-sub-group.use-case.js';
import { DeleteSubGroupUseCase } from '../../application/use-cases/sub-groups/delete-sub-group.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const groupIdParamSchema = z.object({ groupId: z.string().uuid() });
const subGroupIdParamSchema = z.object({ groupId: z.string().uuid(), id: z.string().uuid() });

export async function subGroupRoutes(app: FastifyInstance): Promise<void> {
  const listSubGroupsUseCase = app.diContainer.resolve<ListSubGroupsUseCase>('listSubGroupsUseCase');
  const getSubGroupUseCase = app.diContainer.resolve<GetSubGroupUseCase>('getSubGroupUseCase');
  const createSubGroupUseCase = app.diContainer.resolve<CreateSubGroupUseCase>('createSubGroupUseCase');
  const updateSubGroupUseCase = app.diContainer.resolve<UpdateSubGroupUseCase>('updateSubGroupUseCase');
  const deleteSubGroupUseCase = app.diContainer.resolve<DeleteSubGroupUseCase>('deleteSubGroupUseCase');

  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = parseBody(groupIdParamSchema, request.params);
    const result = await listSubGroupsUseCase.execute(groupId);
    return reply.send(successResponse(result));
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(subGroupIdParamSchema, request.params);
    const result = await getSubGroupUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  app.post('/', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { groupId } = parseBody(groupIdParamSchema, request.params);
    const dto = parseBody(createSubGroupSchema, request.body);
    const result = await createSubGroupUseCase.execute(groupId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.patch('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(subGroupIdParamSchema, request.params);
    const dto = parseBody(updateSubGroupSchema, request.body);
    const result = await updateSubGroupUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  app.delete('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(subGroupIdParamSchema, request.params);
    await deleteSubGroupUseCase.execute(id);
    return reply.send(successResponse(null));
  });
}
