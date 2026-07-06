import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';

import { SaveCommentUseCase } from '../../application/use-cases/comments/save-comment.use-case.js';
import { GetCommentsUseCase } from '../../application/use-cases/comments/get-comments.use-case.js';
import { DeleteCommentUseCase } from '../../application/use-cases/comments/delete-comment.use-case.js';
import { ReplyToCommentUseCase } from '../../application/use-cases/comments/reply-to-comment.use-case.js';
import { ResolveCommentUseCase } from '../../application/use-cases/comments/resolve-comment.use-case.js';

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

const replyCommentSchema = z.object({
  text: z.string().min(1).max(1000),
});

const resolveCommentSchema = z.object({
  resolved: z.boolean(),
});

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  instanceId: z.string().uuid(),
});

export async function commentRoutes(app: FastifyInstance): Promise<void> {
  const saveCommentUseCase = app.diContainer.resolve<SaveCommentUseCase>('saveCommentUseCase');
  const getCommentsUseCase = app.diContainer.resolve<GetCommentsUseCase>('getCommentsUseCase');
  const deleteCommentUseCase = app.diContainer.resolve<DeleteCommentUseCase>('deleteCommentUseCase');
  const replyToCommentUseCase = app.diContainer.resolve<ReplyToCommentUseCase>('replyToCommentUseCase');
  const resolveCommentUseCase = app.diContainer.resolve<ResolveCommentUseCase>('resolveCommentUseCase');

  // GET /api/v1/comments?instanceId=...
  app.get('/', {
    schema: { description: 'Lister les commentaires (avec leurs réponses)', tags: ['Commentaires'], security: [{ bearerAuth: [] }], querystring: zodToSwagger(listQuerySchema) },
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

  // POST /api/v1/comments/:id/reply
  app.post('/:id/reply', {
    schema: { description: 'Répondre à un commentaire', tags: ['Commentaires'], security: [{ bearerAuth: [] }], body: zodToSwagger(replyCommentSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const { text } = parseBody(replyCommentSchema, request.body);
    const userId = (request.user as { sub: string }).sub;
    const comment = await replyToCommentUseCase.execute(userId, id, text);
    return reply.status(201).send(successResponse(comment));
  });

  // PATCH /api/v1/comments/:id/resolve
  app.patch('/:id/resolve', {
    schema: { description: 'Marquer un commentaire comme résolu/non résolu', tags: ['Commentaires'], security: [{ bearerAuth: [] }], body: zodToSwagger(resolveCommentSchema) },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const { resolved } = parseBody(resolveCommentSchema, request.body);
    const comment = await resolveCommentUseCase.execute(id, resolved);
    return reply.send(successResponse(comment));
  });

  // DELETE /api/v1/comments/:id
  app.delete('/:id', {
    schema: { description: 'Supprimer un commentaire', tags: ['Commentaires'], security: [{ bearerAuth: [] }] },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = parseBody(idParamSchema, request.params);
    const userId = (request.user as { sub: string }).sub;
    await deleteCommentUseCase.execute(userId, id);
    return reply.status(204).send();
  });
}
