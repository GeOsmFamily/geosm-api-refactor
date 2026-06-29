import { PrismaCommentRepository, CommentRecord } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';

export class GetCommentsUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(instanceId: string): Promise<CommentRecord[]> {
    return this.commentRepository.findByInstanceId(instanceId);
  }
}
