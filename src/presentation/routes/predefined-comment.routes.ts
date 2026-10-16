import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { Role } from '../../domain/enums.js';
import type { PredefinedCommentsUseCases } from '../../application/use-cases/comments/predefined-comments.use-cases.js';

const instanceParams = z.object({ id: z.string().uuid() });
const itemParams = z.object({ id: z.string().uuid(), cid: z.string().uuid() });
const createBody = z.object({
  label: z.string().trim().min(1).max(200),
  order: z.number().int().min(0).max(10_000).optional(),
});
const updateBody = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    order: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((b) => b.label !== undefined || b.order !== undefined, {
    message: 'label ou order attendu',
  });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format() as Record<string, unknown>);
  }
  return result.data;
}

/**
 * Commentaires predefinis par instance (chantier D, R4) :
 *   GET    /instances/:id/predefined-comments              (public, outil de commentaire)
 *   GET    /admin/instances/:id/predefined-comments        (back-office)
 *   POST   /admin/instances/:id/predefined-comments        { label, order? }
 *   PATCH  /admin/instances/:id/predefined-comments/:cid   { label?, order? }
 *   DELETE /admin/instances/:id/predefined-comments/:cid   204
 */
export async function predefinedCommentRoutes(app: FastifyInstance): Promise<void> {
  const useCases = app.diContainer.resolve<PredefinedCommentsUseCases>('predefinedCommentsUseCases');
  const adminGuard = [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)];
  const actorOf = (request: FastifyRequest) => ({
    userId: request.user.sub,
    role: request.user.role as Role,
  });

  app.get(
    '/instances/:id/predefined-comments',
    {
      schema: {
        description: "Commentaires predefinis de l'instance, tries par ordre",
        tags: ['Commentaires'],
        params: zodToSwagger(instanceParams),
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(instanceParams, request.params);
      return reply.send(successResponse(await useCases.list(id)));
    },
  );

  app.get(
    '/admin/instances/:id/predefined-comments',
    {
      schema: {
        description: 'Commentaires predefinis (back-office)',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(instanceParams),
      },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(instanceParams, request.params);
      return reply.send(successResponse(await useCases.listForAdmin(actorOf(request), id)));
    },
  );

  app.post(
    '/admin/instances/:id/predefined-comments',
    {
      schema: {
        description: 'Ajouter un commentaire predefini',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(instanceParams),
        body: zodToSwagger(createBody),
      },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(instanceParams, request.params);
      const body = parse(createBody, request.body);
      const created = await useCases.create(actorOf(request), id, body);
      return reply.status(201).send(successResponse(created));
    },
  );

  app.patch(
    '/admin/instances/:id/predefined-comments/:cid',
    {
      schema: {
        description: 'Modifier un commentaire predefini',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(itemParams),
      },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, cid } = parse(itemParams, request.params);
      const body = parse(updateBody, request.body);
      return reply.send(successResponse(await useCases.update(actorOf(request), id, cid, body)));
    },
  );

  app.delete(
    '/admin/instances/:id/predefined-comments/:cid',
    {
      schema: {
        description: 'Supprimer un commentaire predefini',
        tags: ['Administration'],
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(itemParams),
      },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, cid } = parse(itemParams, request.params);
      await useCases.remove(actorOf(request), id, cid);
      return reply.status(204).send();
    },
  );
}
