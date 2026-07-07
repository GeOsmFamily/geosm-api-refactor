import { v4 as uuidv4 } from 'uuid';
import { RegisterDTO, AuthTokensDTO, JwtPayload } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { ITokenService } from '../../services/token.service.js';
import { IEmailService } from '../../services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RegisterUseCase');
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Retourne des tokens (comme LoginUseCase/OsmLoginUseCase) plutôt qu'un simple profil : la
 * connexion n'exige déjà pas d'email vérifié (voir LoginUseCase), donc forcer un aller-retour
 * manuel vers /login juste après l'inscription n'apporte aucune sécurité supplémentaire, juste
 * de la friction. Le mail de vérification reste envoyé et recommandé, mais ne bloque rien.
 */
export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly emailService: IEmailService,
    private readonly emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository,
  ) {}

  async execute(dto: RegisterDTO): Promise<AuthTokensDTO> {
    const email = Email.create(dto.email);

    const existingUser = await this.userRepository.existsByEmail(email.value);
    if (existingUser) {
      logger.warn('Registration rejected: email already in use', { email: email.value });
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.create({
      id: uuidv4(),
      email: email.value,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: null,
      role: Role.VIEWER,
      isActive: true,
      emailVerifiedAt: null,
      lastLoginAt: null,
    });

    const verificationToken = uuidv4();
    await this.emailVerificationTokenRepository.create({
      id: uuidv4(),
      token: verificationToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
    await this.emailService.sendVerificationEmail(user.email, verificationToken);
    logger.info('User registered', { userId: user.id });

    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRefreshToken();
    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      id: uuidv4(),
      token: refreshToken,
      userId: user.id,
      family,
      expiresAt,
      revokedAt: null,
      replacedByToken: null,
    });

    return { accessToken, refreshToken };
  }
}
