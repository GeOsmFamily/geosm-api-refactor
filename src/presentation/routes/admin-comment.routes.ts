import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { AdminListCommentsUseCase } from '../../application/use-cases/comments/admin-list-comments.use-case.js';
import { FlagCommentUseCase } from '../../application/use-cases/comments/flag-comment.use-case.js';
import { AdminDeleteCommentUseCase } from '../../application/use-cases/comments/admin-delete-comment.use-case.js';
import { ReviewCommentReportUseCase } from '../../application/use-cases/comments/review-comment-report.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  instanceId: z.string().uuid().optional(),
  flagged: z.coerce.boolean().optional(),
  resolved: z.coerce.boolean().optional(),
  reportType: z.enum(['FEATURE_CLOSED', 'WRONG_ATTRIBUTE', 'OUTDATED_GEOMETRY', 'OTHER']).optional(),
});

const reviewCommentSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewNote: z.string().optional(),
});

const flagCommentSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

/**
 * File de modération de contenu (Lot A4 admin) - distincte de comment.routes.ts (usage
 * utilisateur normal : créer/répondre/résoudre/supprimer son propre commentaire). Réservée aux
 * admins (SUPER_ADMIN/ADMIN_INSTANCE), montée sous /admin/comments.
 */
export async function adminCommentRoutes(app: FastifyInstance): Promise<void> {
  const adminListCommentsUseCase = app.diContainer.resolve<AdminListCommentsUseCase>(
    'adminListCommentsUseCase',
  );
  const flagCommentUseCase = app.diContainer.resolve<FlagCommentUseCase>('flagCommentUseCase');
  const adminDeleteCommentUseCase = app.diContainer.resolve<AdminDeleteCommentUseCase>(
    'adminDeleteCommentUseCase',
  );
  const reviewCommentReportUseCase = app.diContainer.resolve<ReviewCommentReportUseCase>(
    'reviewCommentReportUseCase',
  );

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les commentaires pour modération',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        querystring: zodToSwagger(listQuerySchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = parseBody(listQuerySchema, request.query);
      const result = await adminListCommentsUseCase.execute(query);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/:id/flag',
    {
      schema: {
        description: 'Signaler un commentaire',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(flagCommentSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const { reason } = parseBody(flagCommentSchema, request.body);
      const result = await flagCommentUseCase.execute(id, true, reason);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/:id/unflag',
    {
      schema: {
        description: "Lever le signalement d'un commentaire",
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const result = await flagCommentUseCase.execute(id, false);
      return reply.send(successResponse(result));
    },
  );

  // POST /:id/review — tranche un signalement structuré (voir plan "Gouvernance citoyenne &
  // qualité IA" du 2026-08-06), distinct de flag/unflag qui ne fait que repérer sans trancher.
  app.post(
    '/:id/review',
    {
      schema: {
        description: 'Approuver ou refuser un signalement citoyen structuré',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(reviewCommentSchema),
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const dto = parseBody(reviewCommentSchema, request.body);
      const result = await reviewCommentReportUseCase.execute({
        reviewerId: request.user.sub,
        commentId: id,
        ...dto,
      });
      return reply.send(successResponse(result));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un commentaire (modération)',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      await adminDeleteCommentUseCase.execute(id);
      return reply.status(204).send();
    },
  );
}
