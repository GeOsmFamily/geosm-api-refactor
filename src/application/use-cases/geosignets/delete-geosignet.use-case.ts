import { PrismaGeosignetRepository } from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteGeosignetUseCase');

/**
 * Correctif sécurité : la version précédente supprimait le géosignet sans jamais vérifier qui
 * faisait la demande (IDOR) - n'importe quel utilisateur authentifié pouvait supprimer le
 * géosignet (signet de carte) de n'importe qui d'autre en devinant/connaissant son UUID.
 */
export class DeleteGeosignetUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const geosignet = await this.geosignetRepository.findById(id);
    if (!geosignet) throw new NotFoundError('Geosignet', id);
    if (geosignet.userId !== userId) {
      logger.warn('Delete geosignet rejected: not the owner (possible IDOR attempt)', {
        requestingUserId: userId,
        ownerId: geosignet.userId,
        geosignetId: id,
      });
      throw new ForbiddenError('Ce géosignet appartient à un autre utilisateur.');
    }
    await this.geosignetRepository.delete(id);
  }
}
