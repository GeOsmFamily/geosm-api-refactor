import { PrismaCommentRepository } from '../../../infrastructure/database/repositories/prisma-comment.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteCommentUseCase');

/**
 * Correctif sécurité : la version précédente supprimait le commentaire sans jamais vérifier
 * qui faisait la demande (IDOR) - n'importe quel utilisateur authentifié pouvait supprimer le
 * commentaire de n'importe qui d'autre en devinant/connaissant son UUID. Même correctif que
 * DeleteAssistantConversationUseCase, qui avait déjà le bon pattern.
 */
export class DeleteCommentUseCase {
  constructor(private readonly commentRepository: PrismaCommentRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const comment = await this.commentRepository.findById(id);
    if (!comment) throw new NotFoundError('Comment', id);
    if (comment.userId !== userId) {
      logger.warn('Delete comment rejected: not the owner (possible IDOR attempt)', {
        requestingUserId: userId,
        ownerId: comment.userId,
        commentId: id,
      });
      throw new ForbiddenError('Ce commentaire appartient à un autre utilisateur.');
    }
    await this.commentRepository.delete(id);
  }
}
