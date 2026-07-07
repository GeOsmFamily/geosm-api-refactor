import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { AdminListFeedbackUseCase } from '../../application/use-cases/feedback/admin-list-feedback.use-case.js';
import { UpdateFeedbackStatusUseCase } from '../../application/use-cases/feedback/update-feedback-status.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  type: z.enum(['BUG', 'SUGGESTION', 'FEATURE_REQUEST']).optional(),
  status: z.enum(['NEW', 'REVIEWED', 'CLOSED']).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'REVIEWED', 'CLOSED']),
  adminNotes: z.string().max(2000).optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

/** Suivi admin des signalements utilisateur (Lot A5) - montée sous /admin/feedback. */
export async function adminFeedbackRoutes(app: FastifyInstance): Promise<void> {
  const adminListFeedbackUseCase = app.diContainer.resolve<AdminListFeedbackUseCase>('adminListFeedbackUseCase');
  const updateFeedbackStatusUseCase = app.diContainer.resolve<UpdateFeedbackStatusUseCase>('updateFeedbackStatusUseCase');

  app.get('/', {
    schema: { description: 'Lister les signalements utilisateur', tags: ['Administration'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listQuerySchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(listQuerySchema, request.query);
    const result = await adminListFeedbackUseCase.execute(query);
    return reply.send(successResponse(result));
  });

  app.patch('/:id', {
    schema: { description: 'Mettre à jour le statut d\'un signalement', tags: ['Administration'], security: [{ bearerAuth: [] }], body: zodToSwagger(updateStatusSchema) },
    preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const { status, adminNotes } = parseBody(updateStatusSchema, request.body);
    const result = await updateFeedbackStatusUseCase.execute(id, status, adminNotes);
    return reply.send(successResponse(result));
  });
}
