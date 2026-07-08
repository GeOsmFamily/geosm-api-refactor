import {
  PrismaGeosignetRepository,
  GeosignetRecord,
} from '../../../infrastructure/database/repositories/prisma-geosignet.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetGeosignetsUseCase');

export class GetGeosignetsUseCase {
  constructor(private readonly geosignetRepository: PrismaGeosignetRepository) {}

  async execute(userId: string): Promise<GeosignetRecord[]> {
    logger.debug('Fetching geosignets', { userId });
    return this.geosignetRepository.findByUserId(userId);
  }
}
