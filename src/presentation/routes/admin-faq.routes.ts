import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';

import { ListDraftInstanceFaqUseCase } from '../../application/use-cases/faq/list-draft-instance-faq.use-case.js';
import { ReviewInstanceFaqUseCase } from '../../application/use-cases/faq/review-instance-faq.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const instanceIdParamSchema = z.object({ instanceId: z.string().uuid() });
const faqIdParamSchema = z.object({ instanceId: z.string().uuid(), id: z.string().uuid() });

const reviewSchema = z.object({
  decision: z.enum(['PUBLISH', 'REJECT']),
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
});

/**
 * Revue admin des FAQ générées automatiquement (voir GenerateInstanceFaqUseCase, job
 * `faq-generation`) - une FAQ DRAFT n'est jamais visible publiquement avant validation, car elle
 * peut refléter des questions sensibles posées par de vrais visiteurs. Montée sous
 * /instances/:instanceId/faq/admin, réservée aux mêmes rôles que la revue de publication de
 * données personnelles (SUPER_ADMIN/ADMIN_INSTANCE/EDITOR).
 */
export async function adminFaqRoutes(app: FastifyInstance): Promise<void> {
  const listDraftInstanceFaqUseCase = app.diContainer.resolve<ListDraftInstanceFaqUseCase>(
    'listDraftInstanceFaqUseCase',
  );
  const reviewInstanceFaqUseCase = app.diContainer.resolve<ReviewInstanceFaqUseCase>(
    'reviewInstanceFaqUseCase',
  );

  app.get(
    '/',
    {
      schema: {
        description: 'Lister les FAQ générées en attente de revue pour cette instance',
        tags: ['FAQ'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parseBody(instanceIdParamSchema, request.params);
      const result = await listDraftInstanceFaqUseCase.execute(instanceId);
      return reply.send(successResponse(result));
    },
  );

  app.post(
    '/:id/review',
    {
      schema: {
        description: 'Publier ou refuser une FAQ générée automatiquement',
        tags: ['FAQ'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(reviewSchema),
      },
      preHandler: [
        app.authenticate,
        requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE, Role.EDITOR),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(faqIdParamSchema, request.params);
      const dto = parseBody(reviewSchema, request.body);
      const result = await reviewInstanceFaqUseCase.execute({
        reviewerId: request.user.sub,
        faqId: id,
        ...dto,
      });
      return reply.send(successResponse(result));
    },
  );
}
