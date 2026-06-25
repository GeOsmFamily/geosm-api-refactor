import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { idParamSchema, successResponse } from '../schemas/common.schema.js';
import { createDefaultThemeSchema, updateDefaultThemeSchema, createDefaultTagSchema } from '../schemas/default-theme.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListDefaultThemesUseCase } from '../../application/use-cases/default-themes/list-default-themes.use-case.js';
import { GetDefaultThemeUseCase } from '../../application/use-cases/default-themes/get-default-theme.use-case.js';
import { CreateDefaultThemeUseCase } from '../../application/use-cases/default-themes/create-default-theme.use-case.js';
import { UpdateDefaultThemeUseCase } from '../../application/use-cases/default-themes/update-default-theme.use-case.js';
import { DeleteDefaultThemeUseCase } from '../../application/use-cases/default-themes/delete-default-theme.use-case.js';
import { GetThemeTagsUseCase } from '../../application/use-cases/default-themes/get-theme-tags.use-case.js';
import { CreateThemeTagUseCase } from '../../application/use-cases/default-themes/create-theme-tag.use-case.js';
import { SeedDefaultThemesUseCase } from '../../application/use-cases/default-themes/seed-default-themes.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function defaultThemeRoutes(app: FastifyInstance): Promise<void> {
  const listDefaultThemesUseCase = app.diContainer.resolve<ListDefaultThemesUseCase>('listDefaultThemesUseCase');
  const getDefaultThemeUseCase = app.diContainer.resolve<GetDefaultThemeUseCase>('getDefaultThemeUseCase');
  const createDefaultThemeUseCase = app.diContainer.resolve<CreateDefaultThemeUseCase>('createDefaultThemeUseCase');
  const updateDefaultThemeUseCase = app.diContainer.resolve<UpdateDefaultThemeUseCase>('updateDefaultThemeUseCase');
  const deleteDefaultThemeUseCase = app.diContainer.resolve<DeleteDefaultThemeUseCase>('deleteDefaultThemeUseCase');
  const getThemeTagsUseCase = app.diContainer.resolve<GetThemeTagsUseCase>('getThemeTagsUseCase');
  const createThemeTagUseCase = app.diContainer.resolve<CreateThemeTagUseCase>('createThemeTagUseCase');
  const seedDefaultThemesUseCase = app.diContainer.resolve<SeedDefaultThemesUseCase>('seedDefaultThemesUseCase');

  // GET / — public, list all themes
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listDefaultThemesUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /:id — public, get theme by id
  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const result = await getDefaultThemeUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  // POST / — Super Admin, create theme
  app.post('/', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createDefaultThemeSchema, request.body);
    const result = await createDefaultThemeUseCase.execute(dto);
    return reply.status(201).send(successResponse(result));
  });

  // PATCH /:id — Super Admin, update theme
  app.patch('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const dto = parseBody(updateDefaultThemeSchema, request.body);
    const result = await updateDefaultThemeUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  // DELETE /:id — Super Admin, delete theme
  app.delete('/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteDefaultThemeUseCase.execute(id);
    return reply.send(successResponse(null));
  });

  // GET /:id/tags — public, get theme tags
  app.get('/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const result = await getThemeTagsUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  // POST /:id/tags — Super Admin, create tag
  app.post('/:id/tags', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const dto = parseBody(createDefaultTagSchema, request.body);
    const result = await createThemeTagUseCase.execute(id, dto);
    return reply.status(201).send(successResponse(result));
  });

  // POST /seed — Super Admin, seed default themes
  app.post('/seed', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await seedDefaultThemesUseCase.execute();
    return reply.status(201).send(successResponse(result));
  });
}
