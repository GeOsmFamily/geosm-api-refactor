import { v4 as uuidv4 } from 'uuid';
import { LoginDTO, AuthTokensDTO, JwtPayload } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { ITokenService } from '../../services/token.service.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { authLoginTotal, authLoginFailedTotal } from '../../../infrastructure/observability/metrics.js';

const logger = createChildLogger('LoginUseCase');

export class LoginUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
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

    const isPasswordValid = await this.passwordService.verify(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      authLoginFailedTotal.inc();
      logger.warn('Login failed: wrong password', { userId: user.id });
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

    await this.userRepository.update(user.id, { lastLoginAt: new Date() });

    authLoginTotal.inc();
    logger.info('Login successful', { userId: user.id });

    return { accessToken, refreshToken };
  }
}
