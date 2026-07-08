import {
  PrismaCommentRepository,
  CommentRecord,
} from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('FlagCommentUseCase');

/** Signale (ou lève le signalement de) un commentaire pour la file de modération admin (Lot A4). */
export class FlagCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(id: string, flagged: boolean, flagReason?: string): Promise<CommentRecord> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) throw new NotFoundError('Comment', id);

    logger.info('Comment flagged status changed', { commentId: id, flagged });
    return this.commentRepository.setFlagged(id, flagged, flagReason);
  }
}
