import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { LogFrontendErrorUseCase } from '../../application/use-cases/logs/log-frontend-error.use-case.js';

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

const frontendErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
});

export async function logsRoutes(app: FastifyInstance): Promise<void> {
  const logFrontendErrorUseCase =
    app.diContainer.resolve<LogFrontendErrorUseCase>('logFrontendErrorUseCase');

  // POST /api/v1/logs/frontend-error
  // authenticateOptional : un visiteur non connecté (ex. page de login) doit aussi pouvoir
  // remonter ses erreurs, pas seulement les utilisateurs authentifiés.
  app.post(
    '/frontend-error',
    {
      schema: {
        description: 'Remonter une erreur JS non gérée côté frontend',
        tags: ['Logs'],
        body: zodToSwagger(frontendErrorSchema),
      },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(frontendErrorSchema, request.body);
      const userId = (request.user as { sub: string } | undefined)?.sub;
      logFrontendErrorUseCase.execute(dto, userId);
      return reply.status(204).send();
    },
  );
}
