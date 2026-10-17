import type { PrismaPostRepository } from '../../../infrastructure/database/repositories/prisma-post.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { SocialNotificationType } from '../../../domain/notifications/social-notification-types.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { createSocialCounter, logSocialEvent } from '../../../infrastructure/observability/social-telemetry.js';
import {
  type Actor,
  type CommentDto,
  commentToDto,
  decodeCursor,
  displayName,
  encodeCursor,
  isModeratorRole,
} from './post-dto.js';
import type { Notifier, PostsUseCases } from './posts.use-cases.js';

const logger = createChildLogger('PostCommentsUseCases');
const commentsCreated = createSocialCounter('post_comments_created_total', 'Commentaires de publications crees');

export const COMMENT_MAX_LENGTH = 1000;

/**
 * Commentaires des publications : un seul niveau de reponses (RG-E-05), chargement pagine
 * (cahier fonctionnel 4.5.6, viralite locale), j'aime sur les commentaires (ADR 0007).
 */
export class PostCommentsUseCases {
  constructor(
    private readonly repository: PrismaPostRepository,
    private readonly posts: PostsUseCases,
    private readonly notifier: Notifier,
  ) {}

  async list(
    postId: string,
    viewer: Actor | null,
    params: { cursor?: string; limit?: number },
    lang: string,
  ): Promise<{ items: CommentDto[]; nextCursor: string | null; hasMore: boolean }> {
    await this.posts.get(postId, viewer, lang); // meme regle de visibilite que la publication
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const cursor = decodeCursor<{ c: string; i: string }>(params.cursor);
    const after = cursor?.c && cursor.i ? { createdAt: new Date(cursor.c), id: cursor.i } : null;
    const roots = await this.repository.findComments(postId, viewer?.userId ?? null, after, limit + 1);
    const hasMore = roots.length > limit;
    const page = roots.slice(0, limit);
    const ids = page.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
    const liked = viewer ? await this.repository.likedCommentIds(viewer.userId, ids) : new Set<string>();
    const items = page.map((c) => commentToDto(c, viewer?.userId ?? null, liked));
    const last = page[page.length - 1];
    return {
      items,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ c: last.createdAt.toISOString(), i: last.id }) : null,
    };
  }

  async create(
    postId: string,
    actor: Actor,
    input: { content: string; parentId?: string | null },
    lang: string,
  ): Promise<CommentDto> {
    const post = await this.posts.get(postId, actor, lang);
    let parentId: string | null = null;
    let parentAuthorId: string | null = null;
    if (input.parentId) {
      const parent = await this.repository.findCommentById(input.parentId);
      if (!parent || parent.postId !== postId) throw new NotFoundError('PostComment', input.parentId);
      // Une reponse a une reponse s'affiche au meme niveau (RG-E-05).
      parentId = parent.parentId ?? parent.id;
      parentAuthorId = parent.authorId;
    }
    const comment = await this.repository.createComment({
      postId,
      authorId: actor.userId,
      parentId,
      content: input.content.trim(),
    });
    commentsCreated.inc({ instance_id: post.instanceId });
    logSocialEvent(logger, 'info', 'post.comment_created', { userId: actor.userId, instanceId: post.instanceId }, {
      postId,
      commentId: comment.id,
      reply: !!parentId,
    });

    const payload = {
      postId,
      commentId: comment.id,
      authorId: actor.userId,
      authorName: displayName(comment.author),
      excerpt: comment.content.slice(0, 120),
    };
    const recipients = new Set([post.author?.id, parentAuthorId].filter((id): id is string => !!id));
    recipients.delete(actor.userId);
    for (const userId of recipients) {
      void this.notifier.notifyUser(userId, SocialNotificationType.POST_COMMENTED, payload);
    }
    return commentToDto(comment, actor.userId, new Set());
  }

  /** Auteur du commentaire, auteur de la publication, ou moderation. */
  async remove(commentId: string, actor: Actor, lang: string): Promise<void> {
    const comment = await this.repository.findCommentById(commentId);
    if (!comment) throw new NotFoundError('PostComment', commentId);
    const post = await this.posts.get(comment.postId, actor, lang);
    const allowed =
      comment.authorId === actor.userId ||
      post.author?.id === actor.userId ||
      (isModeratorRole(actor.role) &&
        (actor.role === 'SUPER_ADMIN' || (await this.repository.isInstanceAdmin(actor.userId, post.instanceId))));
    if (!allowed) throw new ForbiddenError('Suppression non autorisee');
    await this.repository.deleteComment(commentId, comment.postId);
    logSocialEvent(logger, 'info', 'post.comment_deleted', { userId: actor.userId, instanceId: post.instanceId }, {
      postId: comment.postId,
      commentId,
    });
  }

  async toggleLike(commentId: string, actor: Actor, lang: string): Promise<{ commentId: string; liked: boolean; likeCount: number }> {
    const comment = await this.repository.findCommentById(commentId);
    if (!comment || (comment.hidden && comment.authorId !== actor.userId)) {
      throw new NotFoundError('PostComment', commentId);
    }
    await this.posts.get(comment.postId, actor, lang);
    return { commentId, ...(await this.repository.toggleCommentLike(commentId, actor.userId)) };
  }
}
