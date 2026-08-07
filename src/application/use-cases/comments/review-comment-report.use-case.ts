import type { PrismaCommentRepository } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import type { CommentRecord } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';

export interface ReviewCommentReportInput {
  reviewerId: string;
  commentId: string;
  decision: 'APPROVE' | 'REJECT';
  reviewNote?: string;
}

/** Tranche un signalement citoyen (voir plan "Gouvernance citoyenne & qualité IA" du
 * 2026-08-06) - calqué sur ReviewPersonalLayerPublicationUseCase (même shape de décision), mais
 * plus simple : pas de promotion vers une autre entité, juste un statut de revue + sortie de la
 * file de modération. Contrairement à setFlagged (qui ne fait que repérer), review() consigne
 * qui a tranché et pourquoi. */
export class ReviewCommentReportUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(input: ReviewCommentReportInput): Promise<CommentRecord> {
    const comment = await this.commentRepository.findById(input.commentId);
    if (!comment) throw new NotFoundError('Comment', input.commentId);

    return this.commentRepository.review(input.commentId, {
      reviewedBy: input.reviewerId,
      decision: input.decision,
      reviewNote: input.reviewNote ?? null,
    });
  }
}
