import {
  PrismaMapCompositionRepository,
  MapCompositionRecord,
} from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetMapCompositionUseCase');

export class GetMapCompositionUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(id: string): Promise<MapCompositionRecord> {
    logger.debug('Getting map composition', { compositionId: id });
    const record = await this.mapCompositionRepository.findById(id);
    if (!record) throw new NotFoundError('MapComposition', id);
    return record;
  }
}
