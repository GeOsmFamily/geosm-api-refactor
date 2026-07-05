import { PrismaCommentRepository, CommentRecord } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';

export class ResolveCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(id: string, resolved: boolean): Promise<CommentRecord> {
    return this.commentRepository.setResolved(id, resolved);
  }
}
