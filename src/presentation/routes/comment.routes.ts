import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { SaveCommentUseCase } from '../../application/use-cases/comments/save-comment.use-case.js';
import { GetCommentsUseCase } from '../../application/use-cases/comments/get-comments.use-case.js';
import { DeleteCommentUseCase } from '../../application/use-cases/comments/delete-comment.use-case.js';

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error.format());
  return result.data;
}

const createCommentSchema = z.object({
  instanceId: z.string().uuid(),
  text: z.string().min(1).max(1000),
  lat: z.number(),
  lon: z.number(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  instanceId: z.string().uuid(),
});

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  const saveCommentUseCase = app.diContainer.resolve<SaveCommentUseCase>('saveCommentUseCase');
  const getCommentsUseCase = app.diContainer.resolve<GetCommentsUseCase>('getCommentsUseCase');
  const deleteCommentUseCase = app.diContainer.resolve<DeleteCommentUseCase>('deleteCommentUseCase');

  // GET /api/v1/comments?instanceId=...
  app.get('/', {
    schema: { description: 'Lister les commentaires', tags: ['Commentaires'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listQuerySchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { instanceId } = parseBody(listQuerySchema, request.query);
    const comments = await getCommentsUseCase.execute(instanceId);
    return reply.send(successResponse(comments));
  });

  // POST /api/v1/comments
  app.post('/', {
    schema: { description: 'Créer un commentaire', tags: ['Commentaires'], security: [{ bearerAuth: [] }], body: zodToSwagger(createCommentSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const dto = parseBody(createCommentSchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const comment = await saveCommentUseCase.execute(userId, dto);
    return reply.status(201).send(successResponse(comment));
  });

  // DELETE /api/v1/comments/:id
  app.delete('/:id', {
    schema: { description: 'Supprimer un commentaire', tags: ['Commentaires'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    await deleteCommentUseCase.execute(id);
    return reply.status(204).send();
  });
}
