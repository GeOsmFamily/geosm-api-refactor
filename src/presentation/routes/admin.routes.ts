import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { jobIdParamSchema } from '../schemas/admin.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { GetDashboardUseCase } from '../../application/use-cases/admin/get-dashboard.use-case.js';
import { ListJobsUseCase } from '../../application/use-cases/admin/list-jobs.use-case.js';
import { GetJobDetailsUseCase } from '../../application/use-cases/admin/get-job-details.use-case.js';
import { RetryJobUseCase } from '../../application/use-cases/admin/retry-job.use-case.js';
import { ImportOsmDataUseCase } from '../../application/use-cases/admin/import-osm-data.use-case.js';
import { GetSystemHealthUseCase } from '../../application/use-cases/admin/get-system-health.use-case.js';
import { RedisService } from '../../infrastructure/cache/redis.service.js';

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

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const getDashboardUseCase = app.diContainer.resolve<GetDashboardUseCase>('getDashboardUseCase');
  const listJobsUseCase = app.diContainer.resolve<ListJobsUseCase>('listJobsUseCase');
  const getJobDetailsUseCase = app.diContainer.resolve<GetJobDetailsUseCase>('getJobDetailsUseCase');
  const retryJobUseCase = app.diContainer.resolve<RetryJobUseCase>('retryJobUseCase');
  const importOsmDataUseCase = app.diContainer.resolve<ImportOsmDataUseCase>('importOsmDataUseCase');
  const getSystemHealthUseCase = app.diContainer.resolve<GetSystemHealthUseCase>('getSystemHealthUseCase');
  const redisService = app.diContainer.resolve<RedisService>('redisService');

  // GET /dashboard — returns stats
  app.get('/dashboard', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await getDashboardUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /jobs — returns job list with real queue data
  app.get('/jobs', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await listJobsUseCase.execute();
    return reply.send(successResponse(result));
  });

  // GET /jobs/:id — returns job details
  app.get('/jobs/:id', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = parseBody(jobIdParamSchema, request.params);
    const result = await getJobDetailsUseCase.execute(params.id);
    if (!result) {
      return reply.status(404).send({ success: false, message: 'Job not found' });
    }
    return reply.send(successResponse(result));
  });

  // POST /jobs/:id/retry — retry a failed job
  app.post('/jobs/:id/retry', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(jobIdParamSchema, request.params);
    const result = await retryJobUseCase.execute(id);
    const status = result.success ? 200 : 400;
    return reply.status(status).send(successResponse(result));
  });

  // POST /osm/import — import OSM data via osm2pgsql
  app.post('/osm/import', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(importOsmSchema, request.body);
    const result = await importOsmDataUseCase.execute(body);
    return reply.send(successResponse(result));
  });

  // GET /health — returns system health
  app.get('/health', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const result = await getSystemHealthUseCase.execute();
    return reply.send(successResponse(result));
  });

  // POST /cache/clear — clears Redis cache
  app.post('/cache/clear', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    await redisService.getClient().flushdb();
    return reply.send(successResponse({ message: 'Cache cleared successfully' }));
  });
}
