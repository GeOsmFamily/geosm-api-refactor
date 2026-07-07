import { PrismaCommentRepository, CommentRecord, AdminListCommentsOptions } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AdminListCommentsUseCase');

export class AdminListCommentsUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(options: AdminListCommentsOptions): Promise<{ data: CommentRecord[]; total: number }> {
    logger.debug('Admin listing comments', options);
    return this.commentRepository.adminList(options);
  }
}
