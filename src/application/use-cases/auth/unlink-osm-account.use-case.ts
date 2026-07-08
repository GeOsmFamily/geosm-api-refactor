import { PrismaOsmProfileRepository } from '../../../infrastructure/database/repositories/prisma-osm-profile.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('UnlinkOsmAccountUseCase');

export class UnlinkOsmAccountUseCase {
  constructor(private readonly osmProfileRepository: PrismaOsmProfileRepository) {}

  async execute(userId: string): Promise<void> {
    const profile = await this.osmProfileRepository.findByUserId(userId);
    if (!profile) throw new NotFoundError('OsmProfile', userId);
    await this.osmProfileRepository.delete(userId);
    logger.info('OSM account unlinked', { userId });
  }
}
