import { v4 as uuidv4 } from 'uuid';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { OsmOAuthService } from '../../../infrastructure/external-apis/osm-oauth.service.js';
import { PrismaOsmProfileRepository } from '../../../infrastructure/database/repositories/prisma-osm-profile.repository.js';
import { encrypt } from '../../../infrastructure/utils/encryption.util.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('LinkOsmAccountUseCase');

/** Lie un compte OSM à un utilisateur DÉJÀ connecté (email/mdp) - depuis les paramètres du profil. */
export class LinkOsmAccountUseCase {
  constructor(
    private readonly osmOAuthService: OsmOAuthService,
    private readonly osmProfileRepository: PrismaOsmProfileRepository,
  ) {}

  async execute(userId: string, code: string): Promise<void> {
    const accessToken = await this.osmOAuthService.exchangeCodeForToken(code);
    const osmProfile = await this.osmOAuthService.getUserDetails(accessToken);
    const osmUserId = BigInt(osmProfile.osmUserId);

    const existingLink = await this.osmProfileRepository.findByOsmUserId(osmUserId);
    if (existingLink && existingLink.userId !== userId) {
      logger.warn('Link OSM account rejected: already linked to another GeOSM account', {
        userId,
        osmUserId: osmProfile.osmUserId,
      });
      throw new ConflictError(
        'This OpenStreetMap account is already linked to another GeOSM account',
      );
    }

    await this.osmProfileRepository.upsert(uuidv4(), {
      userId,
      osmUserId,
      displayName: osmProfile.displayName,
      avatarUrl: osmProfile.avatarUrl,
      osmAccountCreatedAt: osmProfile.accountCreatedAt,
      changesetCount: osmProfile.changesetCount,
      homeLat: osmProfile.homeLat,
      homeLon: osmProfile.homeLon,
      accessTokenEncrypted: encrypt(accessToken),
    });
    logger.info('OSM account linked', { userId, osmUserId: osmProfile.osmUserId });
  }
}
