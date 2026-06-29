import { PrismaCommentRepository } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';

export class DeleteCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(id: string): Promise<void> {
    await this.commentRepository.delete(id);
  }
}
