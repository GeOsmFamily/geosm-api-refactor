import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import {
  TrackEventUseCase,
  TrackEventDTO,
} from '../../application/use-cases/analytics/track-event.use-case.js';
import { GetAnalyticsUseCase } from '../../application/use-cases/analytics/get-analytics.use-case.js';
import { IncrementViewUseCase } from '../../application/use-cases/analytics/increment-view.use-case.js';
import { GetUsageDashboardUseCase } from '../../application/use-cases/analytics/get-usage-dashboard.use-case.js';

function parseBody<T>(
  schema: {
    safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } };
  },
  body: unknown,
): T {
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ValidationError(
      'Validation failed',
      result.error?.format() as Record<string, unknown>,
    );
  return result.data as T;
}

const trackEventSchema = z.object({
  instanceId: z.string().uuid(),
  eventType: z.string().min(1).max(100),
  layerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const incrementViewSchema = z.object({
  type: z.enum(['layer', 'instance']),
  id: z.string().uuid(),
});

const getAnalyticsQuerySchema = z.object({
  instanceId: z.string().uuid(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const getUsageDashboardQuerySchema = z.object({
  instanceId: z.string().uuid().optional(),
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const trackEventUseCase = app.diContainer.resolve<TrackEventUseCase>('trackEventUseCase');
  const getAnalyticsUseCase = app.diContainer.resolve<GetAnalyticsUseCase>('getAnalyticsUseCase');
  const incrementViewUseCase =
    app.diContainer.resolve<IncrementViewUseCase>('incrementViewUseCase');
  const getUsageDashboardUseCase = app.diContainer.resolve<GetUsageDashboardUseCase>(
    'getUsageDashboardUseCase',
  );

  // POST /api/v1/analytics/track
  // authenticateOptional (et non authenticate) : la route reste utilisable sans être connecté
  // (événements anonymes acceptés), mais décode le JWT si présent pour attribuer l'événement
  // à un utilisateur - sans ça, request.user restait toujours undefined ici (aucune route
  // sans preHandler ne décode le JWT), et tous les événements atterrissaient avec userId=null,
  // rendant les suggestions/recommandations personnalisées incapables de fonctionner.
  app.post(
    '/track',
    {
      schema: {
        description: 'Enregistrer un evenement analytique',
        tags: ['Analytiques'],
        body: zodToSwagger(trackEventSchema),
      },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(trackEventSchema, request.body);
      const userId = (request.user as { sub: string } | undefined)?.sub;
      const ipAddress = request.ip;
      const event = await trackEventUseCase.execute(dto.instanceId, {
        ...dto,
        metadata: dto.metadata as TrackEventDTO['metadata'],
        userId,
        ipAddress,
      });
      return reply.status(201).send(successResponse(event));
    },
  );

  // POST /api/v1/analytics/view
  app.post(
    '/view',
    {
      schema: {
        description: 'Incrementer une vue',
        tags: ['Analytiques'],
        body: zodToSwagger(incrementViewSchema),
      },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { type, id } = parseBody(incrementViewSchema, request.body);
      const userId = (request.user as { sub: string } | undefined)?.sub;
      const event = await incrementViewUseCase.execute(type, id, request.ip, userId);
      return reply.status(201).send(successResponse(event));
    },
  );

  // GET /api/v1/analytics (admin only)
  app.get(
    '/',
    {
      schema: {
        description: 'Obtenir les statistiques analytiques (admin)',
        tags: ['Analytiques'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(getAnalyticsQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId, startDate, endDate } = parseBody(getAnalyticsQuerySchema, request.query);
      const stats = await getAnalyticsUseCase.execute(instanceId, startDate, endDate);
      return reply.send(successResponse(stats));
    },
  );

  // GET /api/v1/analytics/usage-dashboard (admin) - voir plan "tableau de bord analytique"
  // du 2026-08-05. instanceId omis = vue plateforme (SUPER_ADMIN uniquement, en pratique un
  // ADMIN_INSTANCE fournira toujours le sien - même posture que instance.routes.ts, qui ne
  // vérifie pas non plus l'appartenance de l'instance au-delà du rôle).
  app.get(
    '/usage-dashboard',
    {
      schema: {
        description: "Tableau de bord d'usage de la plateforme (admin)",
        tags: ['Analytiques'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(getUsageDashboardQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId, days } = parseBody(getUsageDashboardQuerySchema, request.query);
      const lang = (request.headers['accept-language'] as string | undefined)?.slice(0, 2) ?? 'fr';
      const dashboard = await getUsageDashboardUseCase.execute(instanceId ?? null, days, lang);
      return reply.send(successResponse(dashboard));
    },
  );
}
