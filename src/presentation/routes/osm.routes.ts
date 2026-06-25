import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { QueryOsmUseCase } from '../../application/use-cases/osm/query-osm.use-case.js';
import { CreateOsmTableUseCase } from '../../application/use-cases/osm/create-osm-table.use-case.js';

const osmQuerySchema = z.object({
  tables: z.array(z.enum(['point', 'line', 'polygon'])).optional(),
  conditions: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })).min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  limit: z.number().int().positive().max(10000).optional(),
  offset: z.number().int().min(0).optional(),
  columns: z.array(z.string()).optional(),
});

const createOsmTableSchema = z.object({
  schema: z.string().min(1),
  table: z.string().min(1),
  sourceTable: z.enum(['planet_osm_point', 'planet_osm_line', 'planet_osm_polygon']),
  conditions: z.array(z.object({ key: z.string().min(1), value: z.string().min(1) })).min(1),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  boundaryTable: z.string().optional(),
  boundaryId: z.number().optional(),
  boundaryGeomColumn: z.string().optional(),
});

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function osmRoutes(app: FastifyInstance): Promise<void> {
  const queryOsmUseCase = app.diContainer.resolve<QueryOsmUseCase>('queryOsmUseCase');
  const createOsmTableUseCase = app.diContainer.resolve<CreateOsmTableUseCase>('createOsmTableUseCase');

  // POST /query — query OSM data, returns GeoJSON
  app.post('/query', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(osmQuerySchema, request.body);
    const result = await queryOsmUseCase.execute(body);
    return reply.send(successResponse(result));
  });

  // POST /create-table — create derived table from OSM data (admin only)
  app.post('/create-table', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(createOsmTableSchema, request.body);
    const result = await createOsmTableUseCase.execute(body);
    return reply.send(successResponse(result));
  });
}
