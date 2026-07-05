import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { listLayersQuerySchema, createLayerSchema, updateLayerSchema } from '../schemas/layer.schema.js';
import { successResponse, paginatedResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { localize } from '../../application/utils/localize.js';

import { ListLayersUseCase } from '../../application/use-cases/layers/list-layers.use-case.js';
import { GetLayerUseCase } from '../../application/use-cases/layers/get-layer.use-case.js';
import { CreateLayerUseCase } from '../../application/use-cases/layers/create-layer.use-case.js';
import { UpdateLayerUseCase } from '../../application/use-cases/layers/update-layer.use-case.js';
import { DeleteLayerUseCase } from '../../application/use-cases/layers/delete-layer.use-case.js';
import { GetSourceFileUseCase } from '../../application/use-cases/layers/get-source-file.use-case.js';
import { ResyncLayerUseCase } from '../../application/use-cases/layers/resync-layer.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const layerIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

export async function layerRoutes(app: FastifyInstance): Promise<void> {
  const listLayersUseCase = app.diContainer.resolve<ListLayersUseCase>('listLayersUseCase');
  const getLayerUseCase = app.diContainer.resolve<GetLayerUseCase>('getLayerUseCase');
  const createLayerUseCase = app.diContainer.resolve<CreateLayerUseCase>('createLayerUseCase');
  const updateLayerUseCase = app.diContainer.resolve<UpdateLayerUseCase>('updateLayerUseCase');
  const deleteLayerUseCase = app.diContainer.resolve<DeleteLayerUseCase>('deleteLayerUseCase');

  app.get('/', {
    schema: { description: 'Lister les couches', tags: ['Couches'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listLayersQuerySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const query = parseBody(listLayersQuerySchema, request.query);
    const result = await listLayersUseCase.execute(instanceId, query);
    const totalPages = Math.ceil(result.total / (query.limit ?? 20));
    return reply.send(paginatedResponse(result.data, { page: query.page ?? 1, limit: query.limit ?? 20, total: result.total, totalPages }));
  });

  app.get('/:id', {
    schema: { description: 'Obtenir une couche par ID', tags: ['Couches'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(layerIdParamSchema, request.params);
    const result = await getLayerUseCase.execute(id);
    const acceptLang = request.headers['accept-language'];
    const lang = acceptLang ? acceptLang.split(',')[0].split('-')[0].trim().toLowerCase() : 'fr';
    // name/description sont stockés en JSON multilingue ({fr,en}, voir CreateInstanceUseCase) -
    // localisés ici comme sur /catalog (voir GetCatalogUseCase) : cette route sert à activer une
    // couche sur la carte (recommandations, assistant, plans enregistrés), jamais à l'édition,
    // donc renvoyer le nom brut n'a pas d'utilité ici.
    return reply.send(successResponse({ ...result, name: localize(result.name, lang), description: localize(result.description, lang) || null }));
  });

  app.post('/', {
    schema: { description: 'Créer une couche', tags: ['Couches'], security: [{ bearerAuth: [] }], body: zodToSwagger(createLayerSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(instanceIdParamSchema, request.params);
    const dto = parseBody(createLayerSchema, request.body);
    const result = await createLayerUseCase.execute(instanceId, dto);
    return reply.status(201).send(successResponse(result));
  });

  app.patch('/:id', {
    schema: { description: 'Mettre à jour une couche', tags: ['Couches'], security: [{ bearerAuth: [] }], body: zodToSwagger(updateLayerSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(layerIdParamSchema, request.params);
    const dto = parseBody(updateLayerSchema, request.body);
    const result = await updateLayerUseCase.execute(id, dto);
    return reply.send(successResponse(result));
  });

  app.delete('/:id', {
    schema: { description: 'Supprimer une couche', tags: ['Couches'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(layerIdParamSchema, request.params);
    await deleteLayerUseCase.execute(id);
    return reply.send(successResponse(null));
  });

  // GET /:id/source-file — get the original source file from MinIO
  const getSourceFileUseCase = app.diContainer.resolve<GetSourceFileUseCase>('getSourceFileUseCase');
  app.get('/:id/source-file', {
    schema: { description: 'Obtenir le fichier source d\'une couche', tags: ['Couches'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(layerIdParamSchema, request.params);
    const result = await getSourceFileUseCase.execute(id);
    return reply.send(successResponse(result));
  });

  // POST /:id/resync — recharge une couche par défaut depuis les données OSM déjà
  // importées (pas un nouveau téléchargement OSM, voir ResyncLayerUseCase).
  const resyncLayerUseCase = app.diContainer.resolve<ResyncLayerUseCase>('resyncLayerUseCase');
  app.post('/:id/resync', {
    schema: { description: 'Resynchroniser une couche par défaut depuis les données OSM importées', tags: ['Couches'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(layerIdParamSchema, request.params);
    const result = await resyncLayerUseCase.execute(id);
    return reply.send(successResponse(result));
  });
}
