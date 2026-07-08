import {
  PrismaCommentRepository,
  CommentRecord,
} from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ResolveCommentUseCase');

export class ResolveCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(id: string, resolved: boolean): Promise<CommentRecord> {
    logger.info('Comment resolved status changed', { commentId: id, resolved });
    return this.commentRepository.setResolved(id, resolved);
  }
}
