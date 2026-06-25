import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { UploadDocumentUseCase } from '../../application/use-cases/documents/upload-document.use-case.js';
import { ListDocumentsUseCase } from '../../application/use-cases/documents/list-documents.use-case.js';
import { GetDocumentUseCase } from '../../application/use-cases/documents/get-document.use-case.js';
import { DeleteDocumentUseCase } from '../../application/use-cases/documents/delete-document.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const idParamSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  instanceId: z.string().uuid(),
  layerId: z.string().uuid().optional(),
});

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  const uploadUseCase = app.diContainer.resolve<UploadDocumentUseCase>('uploadDocumentUseCase');
  const listUseCase = app.diContainer.resolve<ListDocumentsUseCase>('listDocumentsUseCase');
  const getUseCase = app.diContainer.resolve<GetDocumentUseCase>('getDocumentUseCase');
  const deleteUseCase = app.diContainer.resolve<DeleteDocumentUseCase>('deleteDocumentUseCase');

  // GET /api/v1/documents?instanceId=...&layerId=...
  app.get('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, layerId } = parseBody(listQuerySchema, request.query);
    const docs = await listUseCase.execute(instanceId, layerId);
    return reply.send(successResponse(docs));
  });

  // GET /api/v1/documents/:id
  app.get('/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const doc = await getUseCase.execute(id);
    return reply.send(successResponse(doc));
  });

  // POST /api/v1/documents
  app.post('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) throw new ValidationError('No file uploaded', {});

    const fields = data.fields as Record<string, { value?: string }>;
    const name = fields.name?.value ?? data.filename;
    const description = fields.description?.value;
    const instanceId = fields.instanceId?.value;
    const layerId = fields.layerId?.value;

    if (!instanceId) throw new ValidationError('instanceId is required', {});

    const fileBuffer = await data.toBuffer();
    const userId = (request.user as { sub: string }).sub;

    const doc = await uploadUseCase.execute(userId, {
      name,
      description,
      layerId,
      instanceId,
      fileBuffer,
      fileName: data.filename,
      mimeType: data.mimetype,
      fileSize: fileBuffer.length,
    });
    return reply.status(201).send(successResponse(doc));
  });

  // DELETE /api/v1/documents/:id
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteUseCase.execute(id);
    return reply.status(204).send();
  });
}
