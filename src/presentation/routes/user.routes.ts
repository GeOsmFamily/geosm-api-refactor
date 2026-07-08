import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  changeUserRoleSchema,
  toggleUserActiveSchema,
} from '../schemas/user.schema.js';
import { idParamSchema, successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListUsersUseCase } from '../../application/use-cases/users/list-users.use-case.js';
import { GetUserUseCase } from '../../application/use-cases/users/get-user.use-case.js';
import { CreateUserUseCase } from '../../application/use-cases/users/create-user.use-case.js';
import { UpdateUserUseCase } from '../../application/use-cases/users/update-user.use-case.js';
import { DeleteUserUseCase } from '../../application/use-cases/users/delete-user.use-case.js';
import { ChangeUserRoleUseCase } from '../../application/use-cases/users/change-user-role.use-case.js';
import { ToggleUserActiveUseCase } from '../../application/use-cases/users/toggle-user-active.use-case.js';

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

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const listUsersUseCase = app.diContainer.resolve<ListUsersUseCase>('listUsersUseCase');
  const getUserUseCase = app.diContainer.resolve<GetUserUseCase>('getUserUseCase');
  const createUserUseCase = app.diContainer.resolve<CreateUserUseCase>('createUserUseCase');
  const updateUserUseCase = app.diContainer.resolve<UpdateUserUseCase>('updateUserUseCase');
  const deleteUserUseCase = app.diContainer.resolve<DeleteUserUseCase>('deleteUserUseCase');
  const changeUserRoleUseCase =
    app.diContainer.resolve<ChangeUserRoleUseCase>('changeUserRoleUseCase');
  const toggleUserActiveUseCase =
    app.diContainer.resolve<ToggleUserActiveUseCase>('toggleUserActiveUseCase');

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les utilisateurs',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(listUsersQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = parseBody(listUsersQuerySchema, request.query);
      const result = await listUsersUseCase.execute(query);
      const totalPages = Math.ceil(result.total / (query.limit ?? 20));
      return reply.send(
        paginatedResponse(result.data, {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          total: result.total,
          totalPages,
        }),
      );
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        description: 'Obtenir un utilisateur par ID',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await getUserUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/',
    {
      schema: {
        description: 'Créer un utilisateur',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createUserSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(createUserSchema, request.body);
      const result = await createUserUseCase.execute(dto);
      return reply.status(201).send(successResponse(result));
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        description: 'Mettre à jour un utilisateur',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(updateUserSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const dto = parseBody(updateUserSchema, request.body);
      const result = await updateUserUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un utilisateur',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      await deleteUserUseCase.execute(id);
      return reply.send(successResponse(null));
    },
  );

  app.patch(
    '/:id/role',
    {
      schema: {
        description: "Changer le rôle d'un utilisateur",
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(changeUserRoleSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const dto = parseBody(changeUserRoleSchema, request.body);
      const result = await changeUserRoleUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );

  app.patch(
    '/:id/activate',
    {
      schema: {
        description: 'Activer/désactiver un utilisateur',
        tags: ['Utilisateurs'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(toggleUserActiveSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const dto = parseBody(toggleUserActiveSchema, request.body);
      const result = await toggleUserActiveUseCase.execute(id, dto);
      return reply.send(successResponse(result));
    },
  );
}
