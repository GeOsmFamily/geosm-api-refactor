import { PrismaCommentRepository } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('AdminDeleteCommentUseCase');

/**
 * Suppression par un modérateur, sans vérification de propriété - contrairement à
 * DeleteCommentUseCase (réservé à l'auteur, protection IDOR) qui reste inchangé pour le usage
 * utilisateur normal. Réservée aux routes admin (SUPER_ADMIN/ADMIN_INSTANCE).
 */
export class AdminDeleteCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(id: string): Promise<void> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) throw new NotFoundError('Comment', id);

    logger.info('Comment deleted by moderator', { commentId: id });
    await this.commentRepository.delete(id);
  }
}
