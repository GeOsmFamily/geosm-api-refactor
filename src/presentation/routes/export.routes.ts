import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createExportSchema, createBulkExportSchema, listExportsQuerySchema, exportIdParamSchema } from '../schemas/export.schema.js';
import { successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { CreateExportUseCase } from '../../application/use-cases/exports/create-export.use-case.js';
import { CreateBulkExportUseCase } from '../../application/use-cases/exports/create-bulk-export.use-case.js';
import { ListExportsUseCase } from '../../application/use-cases/exports/list-exports.use-case.js';
import { GetExportUseCase } from '../../application/use-cases/exports/get-export.use-case.js';
import { DeleteExportUseCase } from '../../application/use-cases/exports/delete-export.use-case.js';
import type { MinioStorageService } from '../../infrastructure/storage/minio.service.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function exportRoutes(app: FastifyInstance): Promise<void> {
  const createExportUseCase = app.diContainer.resolve<CreateExportUseCase>('createExportUseCase');
  const createBulkExportUseCase = app.diContainer.resolve<CreateBulkExportUseCase>('createBulkExportUseCase');
  const listExportsUseCase = app.diContainer.resolve<ListExportsUseCase>('listExportsUseCase');
  const getExportUseCase = app.diContainer.resolve<GetExportUseCase>('getExportUseCase');
  const deleteExportUseCase = app.diContainer.resolve<DeleteExportUseCase>('deleteExportUseCase');
  const storageService = app.diContainer.resolve<MinioStorageService>('storageService');

  app.post('/', { schema: { description: 'Creer un export', tags: ['Exports'], security: [{ bearerAuth: [] }], body: zodToSwagger(createExportSchema) }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createExportSchema, request.body);
    const userId = request.user!.sub;
    const result = await createExportUseCase.execute(userId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.post('/bulk', { schema: { description: 'Creer un export groupe (plusieurs couches, zip)', tags: ['Exports'], security: [{ bearerAuth: [] }], body: zodToSwagger(createBulkExportSchema) }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createBulkExportSchema, request.body);
    const userId = request.user!.sub;
    const result = await createBulkExportUseCase.execute(userId, dto);
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
    if (!result.filePath) {
      throw new ValidationError('Export not ready for download', { status: result.status });
    }
    // MINIO_ENDPOINT est un nom d'hôte interne au réseau Docker (ex. "minio"),
    // injoignable depuis le navigateur - on ne peut donc pas rediriger vers une
    // URL pré-signée MinIO. On proxyfie le flux de fichier via l'API à la place
    // (le frontend attend déjà un blob depuis cette route).
    const stream = await storageService.downloadFile(result.filePath);
    const fileName = result.filePath.split('/').pop() || `export-${id}`;
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    reply.header('Content-Type', 'application/octet-stream');
    return reply.send(stream);
  });

  app.delete('/:id', { schema: { description: 'Supprimer un export', tags: ['Exports'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(exportIdParamSchema, request.params);
    await deleteExportUseCase.execute(id);
    return reply.send(successResponse(null));
  });
}
