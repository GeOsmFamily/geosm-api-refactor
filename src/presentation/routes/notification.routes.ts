import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { GetMyNotificationsUseCase } from '../../application/use-cases/notifications/get-my-notifications.use-case.js';
import { MarkNotificationReadUseCase } from '../../application/use-cases/notifications/mark-notification-read.use-case.js';
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/notifications/mark-all-notifications-read.use-case.js';

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

const idParamSchema = z.object({ id: z.string().uuid() });
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

/**
 * Centre de notifications unifié (voir plan "Centre de notifications unifié + plan de
 * scalabilité documenté" du 2026-08-06) - complète le tiroir de tâches existant (jobs
 * asynchrones) plutôt que de le remplacer : les notifications ici couvrent aussi des événements
 * "métier" (réponse à un commentaire, changement de statut d'un signalement...) qui n'ont pas
 * de tâche de fond associée.
 */
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const getMyNotificationsUseCase = app.diContainer.resolve<GetMyNotificationsUseCase>(
    'getMyNotificationsUseCase',
  );
  const markNotificationReadUseCase = app.diContainer.resolve<MarkNotificationReadUseCase>(
    'markNotificationReadUseCase',
  );
  const markAllNotificationsReadUseCase = app.diContainer.resolve<MarkAllNotificationsReadUseCase>(
    'markAllNotificationsReadUseCase',
  );

  app.get(
    '/',
    {
      schema: {
        description: 'Lister mes notifications',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(listQuerySchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = parseBody(listQuerySchema, request.query);
      const result = await getMyNotificationsUseCase.execute(request.user!.sub, query);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/:id/read',
    {
      schema: {
        description: 'Marquer une notification comme lue',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await markNotificationReadUseCase.execute(request.user!.sub, id);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/read-all',
    {
      schema: {
        description: 'Marquer toutes mes notifications comme lues',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const count = await markAllNotificationsReadUseCase.execute(request.user!.sub);
      return reply.send(successResponse({ count }));
    },
  );
}
