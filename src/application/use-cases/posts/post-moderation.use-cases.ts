import type { ReportReason } from '@prisma/client';
import type { PrismaPostRepository } from '../../../infrastructure/database/repositories/prisma-post.repository.js';
import type {
  PrismaContentReportRepository,
  ReportSummary,
} from '../../../infrastructure/database/repositories/prisma-content-report.repository.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { createSocialCounter, logSocialEvent } from '../../../infrastructure/observability/social-telemetry.js';
import { type Actor, displayName } from './post-dto.js';
import type { Notifier } from './posts.use-cases.js';

const logger = createChildLogger('PostModerationUseCases');
const reportsCreated = createSocialCounter('content_reports_total', 'Signalements de contenus', ['target']);

/** Signaleurs distincts au-dela desquels le contenu est masque (RG-E-06, ADR 0007). */
export const AUTO_HIDE_THRESHOLD = 3;

/** Notification a l'auteur de la decision de moderation (cahier fonctionnel 4.5.3). */
export const POST_MODERATED = 'POST_MODERATED';

export type ModerationDecision = 'APPROVE' | 'REJECT';

export interface ReportedItem extends ReportSummary {
  instanceId: string;
  postId: string;
  excerpt: string;
  authorName: string;
  status: string;
}

/**
 * Signalements citoyens et moderation des publications et de leurs commentaires. Le masquage
 * automatique ne supprime rien : la decision revient a la moderation (conserver ou retirer).
 */
export class PostModerationUseCases {
  constructor(
    private readonly posts: PrismaPostRepository,
    private readonly reports: PrismaContentReportRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly notifier: Notifier,
  ) {}

  async reportPost(
    postId: string,
    actor: Actor,
    input: { reason: ReportReason; details?: string | null },
  ): Promise<{ reported: boolean; alreadyReported: boolean }> {
    const post = await this.posts.findById(postId);
    if (!post || post.status === 'REMOVED') throw new NotFoundError('Post', postId);
    if (post.authorId === actor.userId) throw new ValidationError('Vous ne pouvez pas signaler votre publication', {});
    const result = await this.reports.report({
      targetType: 'POST',
      targetId: postId,
      instanceId: post.instanceId,
      reporterId: actor.userId,
      reason: input.reason,
      details: input.details?.trim() || null,
    });
    if (result.created) reportsCreated.inc({ instance_id: post.instanceId, target: 'post' });
    if (result.openReports >= AUTO_HIDE_THRESHOLD && post.status === 'PUBLISHED') {
      await this.posts.setStatus(postId, 'FLAGGED');
      logSocialEvent(logger, 'warn', 'post.auto_hidden', { userId: actor.userId, instanceId: post.instanceId }, {
        postId,
        reports: result.openReports,
      });
    }
    return { reported: true, alreadyReported: !result.created };
  }

  async reportComment(
    commentId: string,
    actor: Actor,
    input: { reason: ReportReason; details?: string | null },
  ): Promise<{ reported: boolean; alreadyReported: boolean }> {
    const comment = await this.posts.findCommentById(commentId);
    if (!comment) throw new NotFoundError('PostComment', commentId);
    if (comment.authorId === actor.userId) throw new ValidationError('Vous ne pouvez pas signaler votre commentaire', {});
    const post = await this.posts.findById(comment.postId);
    if (!post) throw new NotFoundError('Post', comment.postId);
    const result = await this.reports.report({
      targetType: 'POST_COMMENT',
      targetId: commentId,
      instanceId: post.instanceId,
      reporterId: actor.userId,
      reason: input.reason,
      details: input.details?.trim() || null,
    });
    if (result.created) reportsCreated.inc({ instance_id: post.instanceId, target: 'comment' });
    if (result.openReports >= AUTO_HIDE_THRESHOLD && !comment.hidden) {
      await this.posts.setCommentHidden(commentId, true);
      logSocialEvent(logger, 'warn', 'post.comment_auto_hidden', { userId: actor.userId, instanceId: post.instanceId }, {
        commentId,
        reports: result.openReports,
      });
    }
    return { reported: true, alreadyReported: !result.created };
  }

  /** File de moderation d'une instance : contenus signales, les plus signales d'abord. */
  async listReported(actor: Actor, instanceId: string): Promise<ReportedItem[]> {
    await this.requireModerator(actor, instanceId);
    const summaries = await this.reports.listOpen(instanceId);
    const items: ReportedItem[] = [];
    for (const s of summaries) {
      if (s.targetType === 'POST') {
        const post = await this.posts.findById(s.targetId);
        if (!post) continue;
        items.push({ ...s, instanceId, postId: post.id, excerpt: post.content.slice(0, 200), authorName: displayName(post.author), status: post.status });
      } else if (s.targetType === 'POST_COMMENT') {
        const comment = await this.posts.findCommentById(s.targetId);
        if (!comment) continue;
        items.push({
          ...s,
          instanceId,
          postId: comment.postId,
          excerpt: comment.content.slice(0, 200),
          authorName: displayName(comment.author),
          status: comment.hidden ? 'HIDDEN' : 'VISIBLE',
        });
      }
    }
    return items;
  }

  /** Conserver (republie) ou retirer (REMOVED, garde pour audit) une publication signalee. */
  async reviewPost(postId: string, actor: Actor, decision: ModerationDecision, note?: string | null): Promise<{ id: string; status: string }> {
    const post = await this.posts.findById(postId);
    if (!post) throw new NotFoundError('Post', postId);
    await this.requireModerator(actor, post.instanceId);
    const status = decision === 'APPROVE' ? 'PUBLISHED' : 'REMOVED';
    await this.posts.setStatus(postId, status);
    await this.reports.resolve('POST', postId, actor.userId);
    if (post.authorId) {
      void this.notifier.notifyUser(post.authorId, POST_MODERATED, {
        postId,
        decision,
        note: note?.trim() || null,
        excerpt: post.content.slice(0, 120),
      });
    }
    logSocialEvent(logger, 'info', 'post.reviewed', { userId: actor.userId, instanceId: post.instanceId }, { postId, decision });
    return { id: postId, status };
  }

  /** Conserver (de nouveau visible) ou retirer (reste masque) un commentaire signale. */
  async reviewComment(commentId: string, actor: Actor, decision: ModerationDecision): Promise<{ id: string; hidden: boolean }> {
    const comment = await this.posts.findCommentById(commentId);
    if (!comment) throw new NotFoundError('PostComment', commentId);
    const post = await this.posts.findById(comment.postId);
    if (!post) throw new NotFoundError('Post', comment.postId);
    await this.requireModerator(actor, post.instanceId);
    const hidden = decision === 'REJECT';
    await this.posts.setCommentHidden(commentId, hidden);
    await this.reports.resolve('POST_COMMENT', commentId, actor.userId);
    logSocialEvent(logger, 'info', 'post.comment_reviewed', { userId: actor.userId, instanceId: post.instanceId }, {
      commentId,
      decision,
    });
    return { id: commentId, hidden };
  }

  private async requireModerator(actor: Actor, instanceId: string): Promise<void> {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);
    if (actor.role === 'SUPER_ADMIN') return;
    if (actor.role === 'ADMIN_INSTANCE' && (await this.posts.isInstanceAdmin(actor.userId, instanceId))) return;
    throw new ForbiddenError("Vous ne moderez pas cette instance");
  }
}
