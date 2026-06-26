import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { SaveDrawingUseCase, SaveDrawingDTO } from '../../application/use-cases/drawings/save-drawing.use-case.js';
import { GetDrawingsUseCase } from '../../application/use-cases/drawings/get-drawings.use-case.js';
import { GetDrawingUseCase } from '../../application/use-cases/drawings/get-drawing.use-case.js';
import { DeleteDrawingUseCase } from '../../application/use-cases/drawings/delete-drawing.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const createDrawingSchema = z.object({
  instanceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  geojson: z.record(z.unknown()),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  instanceId: z.string().uuid(),
});

export async function drawingRoutes(app: FastifyInstance): Promise<void> {
  const saveDrawingUseCase = app.diContainer.resolve<SaveDrawingUseCase>('saveDrawingUseCase');
  const getDrawingsUseCase = app.diContainer.resolve<GetDrawingsUseCase>('getDrawingsUseCase');
  const getDrawingUseCase = app.diContainer.resolve<GetDrawingUseCase>('getDrawingUseCase');
  const deleteDrawingUseCase = app.diContainer.resolve<DeleteDrawingUseCase>('deleteDrawingUseCase');

  // GET /api/v1/drawings?instanceId=...
  app.get('/', {
    schema: { description: 'Lister les dessins', tags: ['Dessins'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listQuerySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(listQuerySchema, request.query);
    const userId = (request.user as { sub: string }).sub;
    const drawings = await getDrawingsUseCase.execute(userId, instanceId);
    return reply.send(successResponse(drawings));
  });

  // GET /api/v1/drawings/:id
  app.get('/:id', {
    schema: { description: 'Obtenir un dessin par ID', tags: ['Dessins'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const drawing = await getDrawingUseCase.execute(id);
    return reply.send(successResponse(drawing));
  });

  // POST /api/v1/drawings
  app.post('/', {
    schema: { description: 'Creer un dessin', tags: ['Dessins'], security: [{ bearerAuth: [] }], body: zodToSwagger(createDrawingSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createDrawingSchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const drawing = await saveDrawingUseCase.execute(userId, dto.instanceId, { ...dto, geojson: dto.geojson as SaveDrawingDTO['geojson'] });
    return reply.status(201).send(successResponse(drawing));
  });

  // DELETE /api/v1/drawings/:id
  app.delete('/:id', {
    schema: { description: 'Supprimer un dessin', tags: ['Dessins'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteDrawingUseCase.execute(id);
    return reply.status(204).send();
  });
}
