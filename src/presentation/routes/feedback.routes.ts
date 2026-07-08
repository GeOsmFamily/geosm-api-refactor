import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { FeedbackType } from '@prisma/client';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { SubmitFeedbackUseCase } from '../../application/use-cases/feedback/submit-feedback.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const submitFeedbackSchema = z.object({
  type: z.nativeEnum(FeedbackType),
  description: z.string().min(1).max(5000),
  contactEmail: z.string().email().optional(),
  page: z.string().max(500).optional(),
});

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  const submitFeedbackUseCase =
    app.diContainer.resolve<SubmitFeedbackUseCase>('submitFeedbackUseCase');

  // POST /api/v1/feedback
  // authenticateOptional : un visiteur non connecté doit pouvoir signaler un problème ou
  // proposer une suggestion, pas seulement les utilisateurs authentifiés.
  app.post(
    '/',
    {
      schema: {
        description: 'Soumettre un signalement (bug, suggestion, demande de fonctionnalité)',
        tags: ['Feedback'],
        body: zodToSwagger(submitFeedbackSchema),
      },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(submitFeedbackSchema, request.body);
      const userId = (request.user as { sub: string } | undefined)?.sub;
      const feedback = await submitFeedbackUseCase.execute(dto, userId);
      return reply.status(201).send(successResponse(feedback));
    },
  );
}
