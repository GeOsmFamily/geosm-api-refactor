import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { listInstancesQuerySchema, createInstanceSchema, updateInstanceSchema, addInstanceUserSchema, changeInstanceUserRoleSchema } from '../schemas/instance.schema.js';
import { idParamSchema, successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListInstancesUseCase } from '../../application/use-cases/instances/list-instances.use-case.js';
import { GetInstanceUseCase } from '../../application/use-cases/instances/get-instance.use-case.js';
import { CreateInstanceUseCase } from '../../application/use-cases/instances/create-instance.use-case.js';
import { UpdateInstanceUseCase } from '../../application/use-cases/instances/update-instance.use-case.js';
import { DeleteInstanceUseCase } from '../../application/use-cases/instances/delete-instance.use-case.js';
import { GetInstanceUsersUseCase } from '../../application/use-cases/instances/get-instance-users.use-case.js';
import { AddInstanceUserUseCase } from '../../application/use-cases/instances/add-instance-user.use-case.js';
import { RemoveInstanceUserUseCase } from '../../application/use-cases/instances/remove-instance-user.use-case.js';
import { ChangeInstanceUserRoleUseCase } from '../../application/use-cases/instances/change-instance-user-role.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const userIdParamSchema = z.object({ instanceId: z.string().uuid(), userId: z.string().uuid() });

export async function instanceRoutes(app: FastifyInstance): Promise<void> {
  const listInstancesUseCase = app.diContainer.resolve<ListInstancesUseCase>('listInstancesUseCase');
  const getInstanceUseCase = app.diContainer.resolve<GetInstanceUseCase>('getInstanceUseCase');
  const createInstanceUseCase = app.diContainer.resolve<CreateInstanceUseCase>('createInstanceUseCase');
  const updateInstanceUseCase = app.diContainer.resolve<UpdateInstanceUseCase>('updateInstanceUseCase');
  const deleteInstanceUseCase = app.diContainer.resolve<DeleteInstanceUseCase>('deleteInstanceUseCase');
  const getInstanceUsersUseCase = app.diContainer.resolve<GetInstanceUsersUseCase>('getInstanceUsersUseCase');
  const addInstanceUserUseCase = app.diContainer.resolve<AddInstanceUserUseCase>('addInstanceUserUseCase');
  const removeInstanceUserUseCase = app.diContainer.resolve<RemoveInstanceUserUseCase>('removeInstanceUserUseCase');
  const changeInstanceUserRoleUseCase = app.diContainer.resolve<ChangeInstanceUserRoleUseCase>('changeInstanceUserRoleUseCase');

  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(listInstancesQuerySchema, request.query);
    const result = await listInstancesUseCase.execute(query);
    const totalPages = Math.ceil(result.total / (query.limit ?? 20));
    return reply.send(paginatedResponse(result.data, { page: query.page ?? 1, limit: query.limit ?? 20, total: result.total, totalPages }));
  });

  app.get('/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const result = await getInstanceUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  app.post('/', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createInstanceSchema, request.body);
    const result = await createInstanceUseCase.execute(dto);
    return reply.status(201).send(successResponse(result));
  });

  app.patch('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const dto = parseBody(updateInstanceSchema, request.body);
    const result = await updateInstanceUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  app.delete('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteInstanceUseCase.execute(id);
    return reply.send(successResponse(null));
  });

  app.get('/:instanceId/users', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await getInstanceUsersUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  app.post('/:instanceId/users', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const dto = parseBody(addInstanceUserSchema, request.body);
    const result = await addInstanceUserUseCase.execute(instanceId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.delete('/:instanceId/users/:userId', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, userId } = parseBody(userIdParamSchema, request.params);
    await removeInstanceUserUseCase.execute(instanceId, userId);
    return reply.send(successResponse(null));
  });

  app.patch('/:instanceId/users/:userId/role', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, userId } = parseBody(userIdParamSchema, request.params);
    const dto = parseBody(changeInstanceUserRoleSchema, request.body);
    const result = await changeInstanceUserRoleUseCase.execute(instanceId, userId, dto);
    return reply.send(successResponse(result));
  });
}
