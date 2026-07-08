import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';
import { AuthTokensDTO, JwtPayload } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { ITokenService } from '../../services/token.service.js';
import { Role } from '../../../domain/enums.js';
import { OsmOAuthService } from '../../../infrastructure/external-apis/osm-oauth.service.js';
import { PrismaOsmProfileRepository } from '../../../infrastructure/database/repositories/prisma-osm-profile.repository.js';
import { encrypt } from '../../../infrastructure/utils/encryption.util.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { authLoginTotal } from '../../../infrastructure/observability/metrics.js';

const logger = createChildLogger('OsmLoginUseCase');

/**
 * Termine le flux OAuth OpenStreetMap (voir OsmOAuthService) : échange le code contre un token,
 * récupère le profil OSM, puis résout un utilisateur local. Si un OsmProfile existe déjà pour
 * cet osmUserId, reconnecte ce compte. Sinon, crée un nouveau compte GeOSM (rôle VIEWER par
 * défaut - décision produit : connexion en un clic, pas de friction pour un nouvel utilisateur ;
 * un admin peut ensuite élever le rôle si besoin) avec un mot de passe aléatoire inutilisable
 * (l'utilisateur ne se connecte que via OSM tant qu'il n'utilise pas "mot de passe oublié").
 */
export class OsmLoginUseCase {
  constructor(
    private readonly osmOAuthService: OsmOAuthService,
    private readonly osmProfileRepository: PrismaOsmProfileRepository,
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(code: string): Promise<AuthTokensDTO> {
    const accessToken = await this.osmOAuthService.exchangeCodeForToken(code);
    const osmProfile = await this.osmOAuthService.getUserDetails(accessToken);
    const osmUserId = BigInt(osmProfile.osmUserId);

    const existingLink = await this.osmProfileRepository.findByOsmUserId(osmUserId);
    let userId: string;
    let role: Role;

    if (existingLink) {
      const user = await this.userRepository.findById(existingLink.userId);
      if (!user)
        throw new Error(
          `OsmProfile ${existingLink.id} references a missing user ${existingLink.userId}`,
        );
      userId = user.id;
      role = user.role;
      logger.info('OSM login: existing linked account', {
        userId,
        osmUserId: osmProfile.osmUserId,
      });
    } else {
      const email = osmProfile.email ?? `osm-${osmProfile.osmUserId}@users.geosm.local`;
      const randomPassword = randomBytes(32).toString('hex');
      const passwordHash = await this.passwordService.hash(randomPassword);
      const [firstName, ...lastNameParts] = osmProfile.displayName.split(' ');

      const user = await this.userRepository.create({
        id: uuidv4(),
        email,
        passwordHash,
        firstName: firstName || osmProfile.displayName,
        lastName: lastNameParts.join(' ') || '',
        avatar: osmProfile.avatarUrl,
        role: Role.VIEWER,
        isActive: true,
        emailVerifiedAt: null,
        lastLoginAt: null,
      });
      userId = user.id;
      role = user.role;
      logger.info('OSM login: new local account auto-created', {
        userId,
        osmUserId: osmProfile.osmUserId,
      });
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

    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error(`User ${userId} vanished right after creation/lookup`);

    const payload: JwtPayload = { sub: user.id, email: user.email, role };
    const jwtAccessToken = this.tokenService.generateAccessToken(payload);
    const jwtRefreshToken = this.tokenService.generateRefreshToken();
    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      id: uuidv4(),
      token: jwtRefreshToken,
      userId: user.id,
      family,
      expiresAt,
      revokedAt: null,
      replacedByToken: null,
    });

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });
    authLoginTotal.inc();

    return { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken };
  }
}
