import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListContainersUseCase } from '../../application/use-cases/docker/list-containers.use-case.js';
import { GetContainerStatsUseCase } from '../../application/use-cases/docker/get-container-stats.use-case.js';
import { GetContainerLogsUseCase } from '../../application/use-cases/docker/get-container-logs.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const idParamSchema = z.object({ id: z.string().min(1) });
const logsQuerySchema = z.object({ tail: z.coerce.number().int().min(1).max(2000).optional() });

/**
 * Lot A8 admin - visibilité Docker EN LECTURE SEULE (décision produit : pas de start/stop/
 * restart, explicitement refusé). Passe par docker-socket-proxy (voir DockerService), jamais le
 * socket brut. Réservé à SUPER_ADMIN (pas ADMIN_INSTANCE - l'infra est globale, pas scopée par
 * instance).
 */
export async function adminDockerRoutes(app: FastifyInstance): Promise<void> {
  const listContainersUseCase =
    app.diContainer.resolve<ListContainersUseCase>('listContainersUseCase');
  const getContainerStatsUseCase = app.diContainer.resolve<GetContainerStatsUseCase>(
    'getContainerStatsUseCase',
  );
  const getContainerLogsUseCase =
    app.diContainer.resolve<GetContainerLogsUseCase>('getContainerLogsUseCase');

  app.get(
    '/containers',
    {
      schema: {
        description: 'Lister les conteneurs Docker (lecture seule)',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await listContainersUseCase.execute();
      return reply.send(successResponse(result));
    },
  );

  app.get(
    '/containers/:id/stats',
    {
      schema: {
        description: "Statistiques CPU/mémoire d'un conteneur",
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await getContainerStatsUseCase.execute(id);
      return reply.send(successResponse(result));
    },
  );

  app.get(
    '/containers/:id/logs',
    {
      schema: {
        description: "Derniers logs d'un conteneur",
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(logsQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const { tail } = parseBody(logsQuerySchema, request.query);
      const result = await getContainerLogsUseCase.execute(id, tail);
      return reply.send(successResponse(result));
    },
  );
}
