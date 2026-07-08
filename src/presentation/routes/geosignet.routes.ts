import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { SaveGeosignetUseCase } from '../../application/use-cases/geosignets/save-geosignet.use-case.js';
import { GetGeosignetsUseCase } from '../../application/use-cases/geosignets/get-geosignets.use-case.js';
import { DeleteGeosignetUseCase } from '../../application/use-cases/geosignets/delete-geosignet.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const createGeosignetSchema = z.object({
  name: z.string().min(1).max(255),
  center: z.array(z.number()).min(2).max(2),
  zoom: z.number(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

export async function geosignetRoutes(app: FastifyInstance): Promise<void> {
  const saveGeosignetUseCase =
    app.diContainer.resolve<SaveGeosignetUseCase>('saveGeosignetUseCase');
  const getGeosignetsUseCase =
    app.diContainer.resolve<GetGeosignetsUseCase>('getGeosignetsUseCase');
  const deleteGeosignetUseCase =
    app.diContainer.resolve<DeleteGeosignetUseCase>('deleteGeosignetUseCase');

  // GET /api/v1/geosignets
  app.get(
    '/',
    {
      schema: {
        description: 'Lister les géosignets',
        tags: ['Géosignets'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as { sub: string }).sub;
      const geosignets = await getGeosignetsUseCase.execute(userId);
      return reply.send(successResponse(geosignets));
    },
  );

  // POST /api/v1/geosignets
  app.post(
    '/',
    {
      schema: {
        description: 'Créer un géosignet',
        tags: ['Géosignets'],
        security: [{ bearerAuth: [] }],
        body: zodToSwagger(createGeosignetSchema),
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const dto = parseBody(createGeosignetSchema, request.body);
      const userId = (request.user as { sub: string }).sub;
      const geosignet = await saveGeosignetUseCase.execute(userId, dto);
      return reply.status(201).send(successResponse(geosignet));
    },
  );

  // DELETE /api/v1/geosignets/:id
  app.delete(
    '/:id',
    {
      schema: {
        description: 'Supprimer un géosignet',
        tags: ['Géosignets'],
        security: [{ bearerAuth: [] }],
      },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseBody(idParamSchema, request.params);
      const userId = (request.user as { sub: string }).sub;
      await deleteGeosignetUseCase.execute(userId, id);
      return reply.status(204).send();
    },
  );
}
