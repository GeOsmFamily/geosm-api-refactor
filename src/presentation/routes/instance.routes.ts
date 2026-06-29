import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { listInstancesQuerySchema, createInstanceSchema, updateInstanceSchema, addInstanceUserSchema, changeInstanceUserRoleSchema } from '../schemas/instance.schema.js';
import { idParamSchema, slugParamSchema, successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { localize } from '../../application/utils/localize.js';

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

  app.get('/', {
    schema: { description: 'Lister les instances', tags: ['Instances'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listInstancesQuerySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(listInstancesQuerySchema, request.query);
    const result = await listInstancesUseCase.execute(query);
    const totalPages = Math.ceil(result.total / (query.limit ?? 20));
    return reply.send(paginatedResponse(result.data, { page: query.page ?? 1, limit: query.limit ?? 20, total: result.total, totalPages }));
  });

  app.get('/slug/:slug', {
    schema: { description: 'Obtenir une instance par slug', tags: ['Instances'], params: zodToSwagger(slugParamSchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { slug } = parseBody(slugParamSchema, request.params);
    const instanceRepository = app.diContainer.resolve<any>('instanceRepository');
    const result = await instanceRepository.findBySlug(slug);
    if (!result) {
      return reply.status(404).send({ message: `Instance with slug ${slug} not found` });
    }
    const lang = request.headers['accept-language']?.startsWith('en') ? 'en' : 'fr';
    const localized = {
      ...result,
      name: localize(result.name, lang),
      description: localize(result.description, lang),
    };
    return reply.send(successResponse(localized));
  });

  app.get('/:id', {
    schema: { description: 'Obtenir une instance par ID', tags: ['Instances'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const result = await getInstanceUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  app.post('/', {
    schema: { description: 'Créer une instance', tags: ['Instances'], security: [{ bearerAuth: [] }], body: zodToSwagger(createInstanceSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createInstanceSchema, request.body);
    const result = await createInstanceUseCase.execute(dto);
    return reply.status(201).send(successResponse(result));
  });

  app.patch('/:id', {
    schema: { description: 'Mettre à jour une instance', tags: ['Instances'], security: [{ bearerAuth: [] }], body: zodToSwagger(updateInstanceSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const dto = parseBody(updateInstanceSchema, request.body);
    const result = await updateInstanceUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  app.delete('/:id', {
    schema: { description: 'Supprimer une instance', tags: ['Instances'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteInstanceUseCase.execute(id);
    return reply.send(successResponse(null));
  });

  app.get('/:instanceId/users', {
    schema: { description: 'Lister les utilisateurs d\'une instance', tags: ['Instances'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const result = await getInstanceUsersUseCase.execute(instanceId);
    return reply.send(successResponse(result));
  });

  app.post('/:instanceId/users', {
    schema: { description: 'Ajouter un utilisateur à une instance', tags: ['Instances'], security: [{ bearerAuth: [] }], body: zodToSwagger(addInstanceUserSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const dto = parseBody(addInstanceUserSchema, request.body);
    const result = await addInstanceUserUseCase.execute(instanceId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.delete('/:instanceId/users/:userId', {
    schema: { description: 'Retirer un utilisateur d\'une instance', tags: ['Instances'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, userId } = parseBody(userIdParamSchema, request.params);
    await removeInstanceUserUseCase.execute(instanceId, userId);
    return reply.send(successResponse(null));
  });

  app.patch('/:instanceId/users/:userId/role', {
    schema: { description: 'Changer le rôle d\'un utilisateur dans une instance', tags: ['Instances'], security: [{ bearerAuth: [] }], body: zodToSwagger(changeInstanceUserRoleSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, userId } = parseBody(userIdParamSchema, request.params);
    const dto = parseBody(changeInstanceUserRoleSchema, request.body);
    const result = await changeInstanceUserRoleUseCase.execute(instanceId, userId, dto);
    return reply.send(successResponse(result));
  });
}
