import { PrismaMapCompositionRepository } from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('DeleteMapCompositionUseCase');

export class DeleteMapCompositionUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.mapCompositionRepository.findById(id);
    if (!existing) throw new NotFoundError('MapComposition', id);
    await this.mapCompositionRepository.delete(id);
    logger.info('Map composition deleted', { compositionId: id });
  }
}
