import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { TrackEventUseCase, TrackEventDTO } from '../../application/use-cases/analytics/track-event.use-case.js';
import { GetAnalyticsUseCase } from '../../application/use-cases/analytics/get-analytics.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const trackEventSchema = z.object({
  instanceId: z.string().uuid(),
  eventType: z.string().min(1).max(100),
  layerId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const getAnalyticsQuerySchema = z.object({
  instanceId: z.string().uuid(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const trackEventUseCase = app.diContainer.resolve<TrackEventUseCase>('trackEventUseCase');
  const getAnalyticsUseCase = app.diContainer.resolve<GetAnalyticsUseCase>('getAnalyticsUseCase');

  // POST /api/v1/analytics/track
  app.post('/track', async (request: FastifyRequest, reply: FastifyReply) => {
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
  });

  // GET /api/v1/analytics (admin only)
  app.get('/', { preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN)] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId, startDate, endDate } = parseBody(getAnalyticsQuerySchema, request.query);
    const stats = await getAnalyticsUseCase.execute(instanceId, startDate, endDate);
    return reply.send(successResponse(stats));
  });
}
