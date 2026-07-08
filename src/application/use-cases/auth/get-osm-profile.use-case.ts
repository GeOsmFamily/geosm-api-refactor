import { PrismaOsmProfileRepository } from '../../../infrastructure/database/repositories/prisma-osm-profile.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetOsmProfileUseCase');

export interface OsmProfileDTO {
  osmUserId: string;
  displayName: string;
  avatarUrl: string | null;
  osmAccountCreatedAt: Date | null;
  changesetCount: number;
  linkedAt: Date;
}

export class GetOsmProfileUseCase {
  constructor(private readonly osmProfileRepository: PrismaOsmProfileRepository) {}

  async execute(userId: string): Promise<OsmProfileDTO | null> {
    logger.debug('Getting OSM profile', { userId });
    const profile = await this.osmProfileRepository.findByUserId(userId);
    if (!profile) return null;
    return {
      osmUserId: profile.osmUserId.toString(),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      osmAccountCreatedAt: profile.osmAccountCreatedAt,
      changesetCount: profile.changesetCount,
      linkedAt: profile.linkedAt,
    };
  }
}
