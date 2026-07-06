import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { jobIdParamSchema } from '../schemas/admin.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { GetDashboardUseCase } from '../../application/use-cases/admin/get-dashboard.use-case.js';
import { ListJobsUseCase } from '../../application/use-cases/admin/list-jobs.use-case.js';
import { GetJobDetailsUseCase } from '../../application/use-cases/admin/get-job-details.use-case.js';
import { RetryJobUseCase } from '../../application/use-cases/admin/retry-job.use-case.js';
import { ImportOsmDataUseCase } from '../../application/use-cases/admin/import-osm-data.use-case.js';
import { GetSystemHealthUseCase } from '../../application/use-cases/admin/get-system-health.use-case.js';
import { RedisService } from '../../infrastructure/cache/redis.service.js';
import { GenerateIconUseCase } from '../../application/use-cases/admin/generate-icon.use-case.js';
import { ConfigDbUseCase } from '../../application/use-cases/admin/config-db.use-case.js';
import { CreateInstanceTemplateUseCase } from '../../application/use-cases/admin/create-instance-template.use-case.js';
import { ManageSequenceUseCase } from '../../application/use-cases/admin/manage-sequence.use-case.js';
import { ReindexAllLayersUseCase } from '../../application/use-cases/search/reindex-all-layers.use-case.js';
import { DatabaseBackupUseCase } from '../../application/use-cases/admin/database-backup.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const importOsmSchema = z.object({
  pbfPath: z.string().min(1),
  slim: z.boolean().optional(),
  append: z.boolean().optional(),
  styleFile: z.string().optional(),
  cache: z.number().int().positive().optional(),
});

const generateIconSchema = z.object({
  color: z.string().min(1),
  shape: z.enum(['circle', 'square', 'triangle', 'star', 'pin']),
  size: z.number().int().min(8).max(512),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  label: z.string().optional(),
});

const generateIconsSchema = z.union([generateIconSchema, z.array(generateIconSchema)]);

const createInstanceTemplateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  thematiques: z.array(z.string()).optional(),
});

const createSequenceSchema = z.object({
  name: z.string().min(1),
  start: z.number().int().optional(),
  increment: z.number().int().optional(),
});

const deleteSequenceSchema = z.object({ name: z.string().min(1) });

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const getDashboardUseCase = app.diContainer.resolve<GetDashboardUseCase>('getDashboardUseCase');
  const listJobsUseCase = app.diContainer.resolve<ListJobsUseCase>('listJobsUseCase');
  const getJobDetailsUseCase = app.diContainer.resolve<GetJobDetailsUseCase>('getJobDetailsUseCase');
  const retryJobUseCase = app.diContainer.resolve<RetryJobUseCase>('retryJobUseCase');
  const importOsmDataUseCase = app.diContainer.resolve<ImportOsmDataUseCase>('importOsmDataUseCase');
  const getSystemHealthUseCase = app.diContainer.resolve<GetSystemHealthUseCase>('getSystemHealthUseCase');
  const redisService = app.diContainer.resolve<RedisService>('redisService');
  const generateIconUseCase = app.diContainer.resolve<GenerateIconUseCase>('generateIconUseCase');
  const configDbUseCase = app.diContainer.resolve<ConfigDbUseCase>('configDbUseCase');
  const createInstanceTemplateUseCase = app.diContainer.resolve<CreateInstanceTemplateUseCase>('createInstanceTemplateUseCase');
  const manageSequenceUseCase = app.diContainer.resolve<ManageSequenceUseCase>('manageSequenceUseCase');
  const reindexAllLayersUseCase = app.diContainer.resolve<ReindexAllLayersUseCase>('reindexAllLayersUseCase');
  // Bloquant, comme /osm/import (même convention existante pour les opérations admin longues) -
  // un pg_dump complet peut prendre plusieurs minutes sur cette base (tables OSM/SRTM volumineuses),
  // ce n'est pas une erreur : voir docs/deploiement.md pour un exemple d'appel avec timeout généreux.
  const databaseBackupUseCase = app.diContainer.resolve<DatabaseBackupUseCase>('databaseBackupUseCase');

  // GET /dashboard — returns stats
  app.get('/dashboard', { schema: { description: 'Obtenir le tableau de bord', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await getDashboardUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /jobs — returns job list with real queue data
  app.get('/jobs', { schema: { description: 'Lister les taches en file d\'attente', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listJobsUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /jobs/:id — returns job details
  app.get('/jobs/:id', { schema: { description: 'Obtenir les details d\'une tache', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = parseBody(jobIdParamSchema, request.params);
    const result = await getJobDetailsUseCase.execute(params.id);
    if (!result) {
      return reply.status(404).send({ success: false, message: 'Job not found' });
    }
    return reply.send(successResponse(result));
  });

  // POST /jobs/:id/retry — retry a failed job
  app.post('/jobs/:id/retry', { schema: { description: 'Relancer une tache echouee', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(jobIdParamSchema, request.params);
    const result = await retryJobUseCase.execute(id);
    const status = result.success ? 200 : 400;
    return reply.status(status).send(successResponse(result));
  });

  // POST /osm/import — import OSM data via osm2pgsql
  app.post('/osm/import', { schema: { description: 'Importer des donnees OSM via osm2pgsql', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(importOsmSchema) }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(importOsmSchema, request.body);
    const result = await importOsmDataUseCase.execute(body);
    return reply.send(successResponse(result));
  });

  // POST /search/reindex-layers — rattrapage : réindexe toutes les couches de toutes les
  // instances dans MeiliSearch (voir ReindexAllLayersUseCase). Utile si l'index a été
  // recréé/vidé ou si des couches existent sans jamais avoir été indexées.
  app.post('/search/reindex-layers', { schema: { description: 'Reindexer toutes les couches dans MeiliSearch', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await reindexAllLayersUseCase.execute();
    return reply.send(successResponse(result));
  });

  // POST /backup — déclenche un backup Postgres immédiat (voir DatabaseBackupUseCase, aussi
  // planifié quotidiennement via BullMQ, voir server.ts) - utile pour un backup ponctuel avant
  // une opération risquée (migration, import massif), sans attendre le prochain cron.
  app.post('/backup', { schema: { description: 'Déclencher un backup Postgres immédiat', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await databaseBackupUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /health — returns system health
  app.get('/health', { schema: { description: 'Obtenir l\'etat de sante du systeme', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await getSystemHealthUseCase.execute();
    return reply.send(successResponse(result));
  });

  // POST /cache/clear — clears Redis cache
  app.post('/cache/clear', { schema: { description: 'Vider le cache Redis', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    await redisService.getClient().flushdb();
    return reply.send(successResponse({ message: 'Cache cleared successfully' }));
  });

  // POST /icons/generate — generate SVG marker icons
  app.post('/icons/generate', { schema: { description: 'Generer des icones SVG', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(generateIconsSchema) }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(generateIconsSchema, request.body);
    const result = await generateIconUseCase.execute(input);
    return reply.send(successResponse(result));
  });

  // GET /config/db — returns sanitized DB connection info
  app.get('/config/db', { schema: { description: 'Obtenir la configuration de la base de donnees', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await configDbUseCase.execute();
    return reply.send(successResponse(result));
  });

  // POST /instances/template — create instance with default structure
  app.post('/instances/template', { schema: { description: 'Creer un modele d\'instance', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(createInstanceTemplateSchema) }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const input = parseBody(createInstanceTemplateSchema, request.body);
    const result = await createInstanceTemplateUseCase.execute(input);
    return reply.status(201).send(successResponse(result));
  });

  // GET /sequences — list sequences
  app.get('/sequences', { schema: { description: 'Lister les sequences', tags: ['Administration'], security: [{ bearerAuth: [] }] }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await manageSequenceUseCase.listSequences();
    return reply.send(successResponse(result));
  });

  // POST /sequences — create a sequence
  app.post('/sequences', { schema: { description: 'Creer une sequence', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(createSequenceSchema) }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, start, increment } = parseBody(createSequenceSchema, request.body);
    const result = await manageSequenceUseCase.createSequence(name, start, increment);
    return reply.status(201).send(successResponse(result));
  });

  // DELETE /sequences — drop a sequence
  app.delete('/sequences', { schema: { description: 'Supprimer une sequence', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(deleteSequenceSchema) }, preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { name } = parseBody(deleteSequenceSchema, request.body);
    const result = await manageSequenceUseCase.dropSequence(name);
    return reply.send(successResponse(result));
  });
}
