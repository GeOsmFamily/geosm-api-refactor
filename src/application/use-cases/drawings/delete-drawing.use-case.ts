import { PrismaDrawingRepository } from '../../../infrastructure/database/repositories/prisma-drawing.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteDrawingUseCase');

/**
 * Correctif sécurité : la version précédente supprimait le dessin sans jamais vérifier qui
 * faisait la demande (IDOR) - n'importe quel utilisateur authentifié pouvait supprimer le dessin
 * de n'importe qui d'autre en devinant/connaissant son UUID.
 */
export class DeleteDrawingUseCase {
  constructor(private readonly drawingRepository: PrismaDrawingRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const drawing = await this.drawingRepository.findById(id);
    if (!drawing) throw new NotFoundError('Drawing', id);
    if (drawing.userId !== userId) {
      logger.warn('Delete drawing rejected: not the owner (possible IDOR attempt)', { requestingUserId: userId, ownerId: drawing.userId, drawingId: id });
      throw new ForbiddenError('Ce dessin appartient à un autre utilisateur.');
    }
    await this.drawingRepository.delete(id);
  }
}
