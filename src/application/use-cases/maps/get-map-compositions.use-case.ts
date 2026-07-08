import {
  PrismaMapCompositionRepository,
  MapCompositionRecord,
} from '../../../infrastructure/database/repositories/prisma-map-composition.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetMapCompositionsUseCase');

export class GetMapCompositionsUseCase {
  constructor(private readonly mapCompositionRepository: PrismaMapCompositionRepository) {}

  async execute(instanceId: string): Promise<MapCompositionRecord[]> {
    logger.debug('Listing map compositions', { instanceId });
    return this.mapCompositionRepository.findByInstanceId(instanceId);
  }
}
