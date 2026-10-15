import { v4 as uuidv4 } from 'uuid';
import { LoginDTO, AuthTokensDTO, JwtPayload } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { ITokenService } from '../../services/token.service.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { TooManyRequestsError } from '../../../domain/errors/too-many-requests.error.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import {
  authLoginTotal,
  authLoginFailedTotal,
} from '../../../infrastructure/observability/metrics.js';

const logger = createChildLogger('LoginUseCase');

/** RG-A-11 : cinq echecs consecutifs declenchent une temporisation de courte duree. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_SECONDS = 5 * 60;

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(dto: LoginDTO): Promise<AuthTokensDTO> {
    const email = Email.create(dto.email);

    const user = await this.userRepository.findByEmail(email.value);
    if (!user) {
      authLoginFailedTotal.inc();
      logger.warn('Login failed: unknown email', { email: email.value });
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.isActive) {
      authLoginFailedTotal.inc();
      logger.warn('Login failed: account deactivated', { userId: user.id });
      throw new UnauthorizedError('Account is deactivated');
    }

    // Verifie avant le mot de passe : un compte temporise refuse meme le bon mot de passe.
    if (user.lockedUntil && user.lockedUntil.getTime() > this.now()) {
      authLoginFailedTotal.inc();
      const retryAfter = Math.ceil((user.lockedUntil.getTime() - this.now()) / 1000);
      logger.warn('Login refused: account temporarily locked', { userId: user.id });
      throw new TooManyRequestsError(
        'Trop de tentatives de connexion, reessayez plus tard',
        'LOGIN_LOCKED',
        retryAfter,
      );
    }

    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      authLoginFailedTotal.inc();
      // Une temporisation expiree repart d'un compteur propre.
      const previous = user.lockedUntil ? 0 : user.failedLoginAttempts;
      const attempts = previous + 1;
      const lock = attempts >= MAX_FAILED_LOGINS;
      await this.userRepository.update(user.id, {
        failedLoginAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(this.now() + LOCKOUT_SECONDS * 1000) : null,
      });
      logger.warn('Login failed: wrong password', { userId: user.id, attempts, locked: lock });
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

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

    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    authLoginTotal.inc();
    logger.info('Login successful', { userId: user.id });

    return { accessToken, refreshToken };
  }
}
