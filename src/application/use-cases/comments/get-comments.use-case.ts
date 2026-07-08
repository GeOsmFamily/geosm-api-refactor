import {
  PrismaCommentRepository,
  CommentRecord,
} from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetCommentsUseCase');

export class GetCommentsUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(instanceId: string): Promise<CommentRecord[]> {
    logger.debug('Listing comments', { instanceId });
    return this.commentRepository.findByInstanceId(instanceId);
  }
}
