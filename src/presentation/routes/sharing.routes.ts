import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';

import { CreateSharedMapUseCase, CreateSharedMapDTO } from '../../application/use-cases/sharing/create-shared-map.use-case.js';
import { GetSharedMapUseCase } from '../../application/use-cases/sharing/get-shared-map.use-case.js';

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

const createShareSchema = z.object({
  instanceId: z.string().uuid(),
  mapState: z.record(z.unknown()),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

const codeParamSchema = z.object({ code: z.string().length(8) });

export async function sharingRoutes(app: FastifyInstance): Promise<void> {
  const createSharedMapUseCase = app.diContainer.resolve<CreateSharedMapUseCase>('createSharedMapUseCase');
  const getSharedMapUseCase = app.diContainer.resolve<GetSharedMapUseCase>('getSharedMapUseCase');

  // POST /api/v1/share
  app.post('/', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createShareSchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const shared = await createSharedMapUseCase.execute(userId, dto.instanceId, { ...dto, mapState: dto.mapState as CreateSharedMapDTO['mapState'] });
    return reply.status(201).send(successResponse(shared));
  });

  // GET /api/v1/share/:code
  app.get('/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = parseBody(codeParamSchema, request.params);
    const shared = await getSharedMapUseCase.execute(code);
    return reply.send(successResponse(shared));
  });
}
