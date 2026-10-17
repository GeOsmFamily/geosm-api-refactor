import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { successResponse } from '../schemas/common.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { requireVerifiedEmail } from '../middleware/verified-email.middleware.js';
import { resolveLang } from '../utils/lang.util.js';
import { Role } from '../../domain/enums.js';
import type { PostsUseCases } from '../../application/use-cases/posts/posts.use-cases.js';
import { POST_RULES } from '../../application/use-cases/posts/posts.use-cases.js';
import type { PostCommentsUseCases } from '../../application/use-cases/posts/post-comments.use-cases.js';
import { COMMENT_MAX_LENGTH } from '../../application/use-cases/posts/post-comments.use-cases.js';
import type { PostModerationUseCases } from '../../application/use-cases/posts/post-moderation.use-cases.js';
import type { PostMediaUseCase } from '../../application/use-cases/posts/post-media.use-case.js';
import type { Actor } from '../../application/use-cases/posts/post-dto.js';

const uuid = z.string().uuid();
const idParams = z.object({ id: uuid });
const instanceParams = z.object({ instanceId: uuid });

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined));

const bboxParam = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const parts = v.split(',').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bbox attendu : minLon,minLat,maxLon,maxLat' });
      return z.NEVER;
    }
    return parts as [number, number, number, number];
  });

const feedQuery = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    radius: z.coerce.number().int().min(100).max(POST_RULES.feedMaxRadius).optional(),
    bbox: bboxParam,
    tags: csv,
    authorId: uuid.optional(),
    sort: z.enum(['recent', 'popular']).optional(),
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine((q) => (q.lat === undefined) === (q.lon === undefined), {
    message: 'lat et lon vont ensemble',
  });

const tagSlug = z.string().trim().min(1).max(100);
const createBody = z.object({
  content: z.string().trim().min(1).max(POST_RULES.maxContent),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(POST_RULES.minRadius).max(POST_RULES.maxRadius).optional(),
  placeLabel: z.string().trim().max(200).nullish(),
  visibility: z.enum(['PUBLIC', 'GROUP', 'PRIVATE']).optional(),
  groupId: uuid.nullish(),
  tagSlugs: z.array(tagSlug).max(POST_RULES.maxSdgTags + POST_RULES.maxCustomTags),
  media: z
    .array(z.object({ key: z.string().min(1).max(300), type: z.enum(['IMAGE', 'GIF', 'VIDEO']) }))
    .max(POST_RULES.maxMedia)
    .optional(),
});
const updateBody = z
  .object({
    content: z.string().trim().min(1).max(POST_RULES.maxContent).optional(),
    placeLabel: z.string().trim().max(200).nullish(),
    visibility: z.enum(['PUBLIC', 'GROUP', 'PRIVATE']).optional(),
    tagSlugs: z.array(tagSlug).max(POST_RULES.maxSdgTags + POST_RULES.maxCustomTags).optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Aucune modification' });
const reactionBody = z.object({ type: z.literal('LIKE').default('LIKE') });
const commentsQuery = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});
const commentBody = z.object({
  content: z.string().trim().min(1).max(COMMENT_MAX_LENGTH),
  parentId: uuid.nullish(),
});
const reportBody = z.object({
  reason: z.enum(['INAPPROPRIATE', 'WRONG_INFORMATION', 'SPAM', 'OTHER']),
  details: z.string().trim().max(500).nullish(),
});
const reviewBody = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).nullish(),
});
const tagsQuery = z.object({
  instanceId: uuid.optional(),
  category: z.enum(['SDG', 'CUSTOM']).optional(),
});

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format() as Record<string, unknown>);
  }
  return result.data;
}

/**
 * Fil social geolocalise (chantier E, cahier technique 5.2) :
 *   GET    /tags                                   ODD et etiquettes (public)
 *   GET    /instances/:instanceId/posts            fil pagine par curseur (auth facultative)
 *   GET    /instances/:instanceId/posts/pins       epingles de la carte synchronisee
 *   POST   /instances/:instanceId/posts            publier
 *   POST   /posts/media                            televerser une photo, un GIF ou une video
 *   GET    /posts/:id   PATCH /posts/:id   DELETE /posts/:id
 *   POST   /posts/:id/reactions                    j'aime (bascule)
 *   POST   /posts/:id/shares                       partage (compteur)
 *   GET    /posts/:id/comments   POST /posts/:id/comments
 *   DELETE /post-comments/:id    POST /post-comments/:id/likes
 *   POST   /posts/:id/reports    POST /post-comments/:id/reports   signalement citoyen
 *   GET    /admin/instances/:instanceId/reports    file de moderation
 *   POST   /admin/posts/:id/review   POST /admin/post-comments/:id/review
 */
export async function postRoutes(app: FastifyInstance): Promise<void> {
  const posts = app.diContainer.resolve<PostsUseCases>('postsUseCases');
  const comments = app.diContainer.resolve<PostCommentsUseCases>('postCommentsUseCases');
  const moderation = app.diContainer.resolve<PostModerationUseCases>('postModerationUseCases');
  const media = app.diContainer.resolve<PostMediaUseCase>('postMediaUseCase');

  const writer = [app.authenticate, requireVerifiedEmail];
  const adminGuard = [app.authenticate, requireRole(Role.SUPER_ADMIN, Role.ADMIN_INSTANCE)];
  const actorOf = (request: FastifyRequest): Actor => ({
    userId: request.user.sub,
    role: request.user.role as Role,
  });
  const viewerOf = (request: FastifyRequest): Actor | null => (request.user ? actorOf(request) : null);
  const tag = (t: string) => ({ tags: [t] });

  app.get(
    '/tags',
    { schema: { description: 'ODD et etiquettes libres', ...tag('Fil social'), querystring: zodToSwagger(tagsQuery) } },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const q = parse(tagsQuery, request.query);
      return reply.send(successResponse(await posts.listTags(q.instanceId ?? null, resolveLang(request), q.category)));
    },
  );

  app.get(
    '/instances/:instanceId/posts',
    {
      schema: { description: 'Fil geolocalise pagine par curseur', ...tag('Fil social'), params: zodToSwagger(instanceParams) },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parse(instanceParams, request.params);
      const q = parse(feedQuery, request.query);
      const page = await posts.feed(instanceId, viewerOf(request), q, resolveLang(request));
      return reply.header('Vary', 'Authorization, Accept-Language').send({
        success: true,
        data: page.items,
        meta: {
          timestamp: new Date().toISOString(),
          pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
        },
      });
    },
  );

  app.get(
    '/instances/:instanceId/posts/pins',
    {
      schema: { description: 'Epingles des publications sur la carte', ...tag('Fil social'), params: zodToSwagger(instanceParams) },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parse(instanceParams, request.params);
      const q = parse(feedQuery, request.query);
      return reply.send(successResponse(await posts.pins(instanceId, viewerOf(request), q)));
    },
  );

  app.post(
    '/instances/:instanceId/posts',
    {
      schema: {
        description: 'Publier sur le fil (RG-E-01 a RG-E-03)',
        ...tag('Fil social'),
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(instanceParams),
        body: zodToSwagger(createBody),
      },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parse(instanceParams, request.params);
      const body = parse(createBody, request.body);
      const post = await posts.create(instanceId, actorOf(request), body, resolveLang(request));
      return reply.status(201).send(successResponse(post));
    },
  );

  app.post(
    '/posts/media',
    {
      schema: {
        description: 'Televerser un media de publication (JPEG, PNG, WebP, GIF, MP4, WebM)',
        ...tag('Fil social'),
        security: [{ bearerAuth: [] }],
        consumes: ['multipart/form-data'],
      },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const file = await request.file();
      if (!file) throw new ValidationError('Aucun fichier', {});
      const buffer = await file.toBuffer();
      return reply.status(201).send(successResponse(await media.upload(request.user.sub, buffer)));
    },
  );

  app.get(
    '/posts/:id',
    {
      schema: { description: "Detail d'une publication", ...tag('Fil social'), params: zodToSwagger(idParams) },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      return reply.send(successResponse(await posts.get(id, viewerOf(request), resolveLang(request))));
    },
  );

  app.patch(
    '/posts/:id',
    {
      schema: {
        description: "Modifier sa publication (mention « modifie », RG-E-07)",
        ...tag('Fil social'),
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(idParams),
        body: zodToSwagger(updateBody),
      },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      const body = parse(updateBody, request.body);
      return reply.send(successResponse(await posts.update(id, actorOf(request), body, resolveLang(request))));
    },
  );

  app.delete(
    '/posts/:id',
    {
      schema: { description: 'Supprimer une publication', ...tag('Fil social'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams) },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      await posts.remove(id, actorOf(request));
      return reply.status(204).send();
    },
  );

  app.post(
    '/posts/:id/reactions',
    {
      schema: { description: "J'aime / je n'aime plus (RG-E-04)", ...tag('Fil social'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams) },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      parse(reactionBody, request.body ?? {});
      return reply.send(successResponse(await posts.toggleLike(id, actorOf(request))));
    },
  );

  app.post(
    '/posts/:id/shares',
    {
      schema: { description: 'Compter un partage', ...tag('Fil social'), params: zodToSwagger(idParams) },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      return reply.send(successResponse(await posts.share(id, viewerOf(request))));
    },
  );

  app.get(
    '/posts/:id/comments',
    {
      schema: { description: "Commentaires d'une publication", ...tag('Fil social'), params: zodToSwagger(idParams) },
      preHandler: [app.authenticateOptional],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      const q = parse(commentsQuery, request.query);
      const page = await comments.list(id, viewerOf(request), q, resolveLang(request));
      return reply.send({
        success: true,
        data: page.items,
        meta: {
          timestamp: new Date().toISOString(),
          pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
        },
      });
    },
  );

  app.post(
    '/posts/:id/comments',
    {
      schema: {
        description: 'Commenter ou repondre (un niveau, RG-E-05)',
        ...tag('Fil social'),
        security: [{ bearerAuth: [] }],
        params: zodToSwagger(idParams),
        body: zodToSwagger(commentBody),
      },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      const body = parse(commentBody, request.body);
      return reply.status(201).send(successResponse(await comments.create(id, actorOf(request), body, resolveLang(request))));
    },
  );

  app.delete(
    '/post-comments/:id',
    {
      schema: { description: 'Supprimer un commentaire', ...tag('Fil social'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams) },
      preHandler: [app.authenticate],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      await comments.remove(id, actorOf(request), resolveLang(request));
      return reply.status(204).send();
    },
  );

  app.post(
    '/post-comments/:id/likes',
    {
      schema: { description: "J'aime sur un commentaire (bascule)", ...tag('Fil social'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams) },
      preHandler: writer,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      return reply.send(successResponse(await comments.toggleLike(id, actorOf(request), resolveLang(request))));
    },
  );

  for (const [path, target] of [
    ['/posts/:id/reports', 'post'],
    ['/post-comments/:id/reports', 'comment'],
  ] as const) {
    app.post(
      path,
      {
        schema: {
          description: target === 'post' ? 'Signaler une publication' : 'Signaler un commentaire',
          ...tag('Fil social'),
          security: [{ bearerAuth: [] }],
          params: zodToSwagger(idParams),
          body: zodToSwagger(reportBody),
        },
        preHandler: [app.authenticate],
      },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = parse(idParams, request.params);
        const body = parse(reportBody, request.body);
        const result =
          target === 'post'
            ? await moderation.reportPost(id, actorOf(request), body)
            : await moderation.reportComment(id, actorOf(request), body);
        return reply.status(result.alreadyReported ? 200 : 201).send(successResponse(result));
      },
    );
  }

  app.get(
    '/admin/instances/:instanceId/reports',
    {
      schema: { description: 'Contenus signales (moderation)', ...tag('Administration'), security: [{ bearerAuth: [] }], params: zodToSwagger(instanceParams) },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { instanceId } = parse(instanceParams, request.params);
      return reply.send(successResponse(await moderation.listReported(actorOf(request), instanceId)));
    },
  );

  app.post(
    '/admin/posts/:id/review',
    {
      schema: { description: 'Conserver ou retirer une publication signalee', ...tag('Administration'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams), body: zodToSwagger(reviewBody) },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      const body = parse(reviewBody, request.body);
      return reply.send(successResponse(await moderation.reviewPost(id, actorOf(request), body.decision, body.note)));
    },
  );

  app.post(
    '/admin/post-comments/:id/review',
    {
      schema: { description: 'Conserver ou retirer un commentaire signale', ...tag('Administration'), security: [{ bearerAuth: [] }], params: zodToSwagger(idParams), body: zodToSwagger(reviewBody) },
      preHandler: adminGuard,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parse(idParams, request.params);
      const body = parse(reviewBody, request.body);
      return reply.send(successResponse(await moderation.reviewComment(id, actorOf(request), body.decision)));
    },
  );
}
