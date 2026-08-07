import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { GetPublishedInstanceFaqUseCase } from '../../application/use-cases/faq/get-published-instance-faq.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const slugParamSchema = z.object({ instanceSlug: z.string().min(1) });

/**
 * Route publique de consultation de la FAQ d'une instance (aucune authentification, même
 * principe que sharing.routes.ts GET /:code) - ne retourne que les entrées PUBLISHED.
 */
export async function faqRoutes(app: FastifyInstance): Promise<void> {
  const getPublishedInstanceFaqUseCase = app.diContainer.resolve<GetPublishedInstanceFaqUseCase>(
    'getPublishedInstanceFaqUseCase',
  );

  app.get(
    '/:instanceSlug',
    {
      schema: { description: "Obtenir la FAQ publiée d'une instance", tags: ['FAQ'] },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceSlug } = parseBody(slugParamSchema, request.params);
      const result = await getPublishedInstanceFaqUseCase.execute(instanceSlug);
      return reply.send(successResponse(result));
    },
  );
}
