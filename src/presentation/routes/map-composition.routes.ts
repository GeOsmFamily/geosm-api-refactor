import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { CreateMapCompositionUseCase, CreateMapCompositionDTO } from '../../application/use-cases/maps/create-map-composition.use-case.js';
import { GetMapCompositionsUseCase } from '../../application/use-cases/maps/get-map-compositions.use-case.js';
import { GetMapCompositionUseCase } from '../../application/use-cases/maps/get-map-composition.use-case.js';
import { UpdateMapCompositionUseCase } from '../../application/use-cases/maps/update-map-composition.use-case.js';
import { DeleteMapCompositionUseCase } from '../../application/use-cases/maps/delete-map-composition.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const idParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  layers: z.array(z.object({
    layerId: z.string().uuid(),
    style: z.string().optional(),
    opacity: z.number().min(0).max(1).optional(),
    visible: z.boolean().optional(),
  })),
  center: z.object({ lat: z.number(), lon: z.number() }),
  zoom: z.number().int().min(0).max(22).optional(),
  isPublic: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export async function mapCompositionRoutes(app: FastifyInstance): Promise<void> {
  const createUseCase = app.diContainer.resolve<CreateMapCompositionUseCase>('createMapCompositionUseCase');
  const getListUseCase = app.diContainer.resolve<GetMapCompositionsUseCase>('getMapCompositionsUseCase');
  const getOneUseCase = app.diContainer.resolve<GetMapCompositionUseCase>('getMapCompositionUseCase');
  const updateUseCase = app.diContainer.resolve<UpdateMapCompositionUseCase>('updateMapCompositionUseCase');
  const deleteUseCase = app.diContainer.resolve<DeleteMapCompositionUseCase>('deleteMapCompositionUseCase');

  // GET /api/v1/instances/:instanceId/maps
  app.get('/', {
    schema: { description: 'Lister les compositions de carte', tags: ['Compositions de carte'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const maps = await getListUseCase.execute(instanceId);
    return reply.send(successResponse(maps));
  });

  // GET /api/v1/instances/:instanceId/maps/:id
  app.get('/:id', {
    schema: { description: 'Obtenir une composition de carte', tags: ['Compositions de carte'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const map = await getOneUseCase.execute(id);
    return reply.send(successResponse(map));
  });

  // POST /api/v1/instances/:instanceId/maps
  app.post('/', {
    schema: { description: 'Creer une composition de carte', tags: ['Compositions de carte'], security: [{ bearerAuth: [] }], body: zodToSwagger(createSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const dto = parseBody(createSchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const map = await createUseCase.execute(userId, instanceId, dto as CreateMapCompositionDTO);
    return reply.status(201).send(successResponse(map));
  });

  // PUT /api/v1/instances/:instanceId/maps/:id
  app.put('/:id', {
    schema: { description: 'Mettre a jour une composition de carte', tags: ['Compositions de carte'], security: [{ bearerAuth: [] }], body: zodToSwagger(updateSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const dto = parseBody(updateSchema, request.body);
    const map = await updateUseCase.execute(id, dto);
    return reply.send(successResponse(map));
  });

  // DELETE /api/v1/instances/:instanceId/maps/:id
  app.delete('/:id', {
    schema: { description: 'Supprimer une composition de carte', tags: ['Compositions de carte'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteUseCase.execute(id);
    return reply.status(204).send();
  });
}
