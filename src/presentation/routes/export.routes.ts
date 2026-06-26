import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createExportSchema, listExportsQuerySchema, exportIdParamSchema } from '../schemas/export.schema.js';
import { successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { CreateExportUseCase } from '../../application/use-cases/exports/create-export.use-case.js';
import { ListExportsUseCase } from '../../application/use-cases/exports/list-exports.use-case.js';
import { GetExportUseCase } from '../../application/use-cases/exports/get-export.use-case.js';
import { DeleteExportUseCase } from '../../application/use-cases/exports/delete-export.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  const createExportUseCase = app.diContainer.resolve<CreateExportUseCase>('createExportUseCase');
  const listExportsUseCase = app.diContainer.resolve<ListExportsUseCase>('listExportsUseCase');
  const getExportUseCase = app.diContainer.resolve<GetExportUseCase>('getExportUseCase');
  const deleteExportUseCase = app.diContainer.resolve<DeleteExportUseCase>('deleteExportUseCase');

  app.post('/', { schema: { description: 'Creer un export', tags: ['Exports'], security: [{ bearerAuth: [] }], body: zodToSwagger(createExportSchema) }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createExportSchema, request.body);
    const userId = request.user!.sub;
    const result = await createExportUseCase.execute(userId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.get('/', { schema: { description: 'Lister les exports', tags: ['Exports'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listExportsQuerySchema) }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.sub;
    const query = parseBody(listExportsQuerySchema, request.query);
    const result = await listExportsUseCase.execute(userId, { page: query.page, limit: query.limit, status: query.status });
    const totalPages = Math.ceil(result.total / (query.limit ?? 20));
    return reply.send(paginatedResponse(result.data, { page: query.page ?? 1, limit: query.limit ?? 20, total: result.total, totalPages }));
  });

  app.get('/:id', { schema: { description: 'Obtenir un export par identifiant', tags: ['Exports'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(exportIdParamSchema, request.params);
    const result = await getExportUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  app.get('/:id/download', { schema: { description: 'Telecharger un export', tags: ['Exports'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(exportIdParamSchema, request.params);
    const result = await getExportUseCase.execute(id);
    return reply.send(successResponse({ downloadUrl: result.filePath ? `/downloads/${result.filePath}` : null }));
  });

  app.delete('/:id', { schema: { description: 'Supprimer un export', tags: ['Exports'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(exportIdParamSchema, request.params);
    await deleteExportUseCase.execute(id);
    return reply.send(successResponse(null));
  });
}
