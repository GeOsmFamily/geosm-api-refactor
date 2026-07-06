import { v4 as uuidv4 } from 'uuid';
import { RefreshDTO, AuthTokensDTO, JwtPayload } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { ITokenService } from '../../services/token.service.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RefreshTokenUseCase');

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(dto: RefreshDTO): Promise<AuthTokensDTO> {
    const existingToken = await this.refreshTokenRepository.findByToken(dto.refreshToken);
    if (!existingToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (existingToken.isRevoked) {
      await this.refreshTokenRepository.revokeAllByFamily(existingToken.family);
      logger.warn('Refresh token reuse detected - all sessions in family revoked (possible token theft)', {
        userId: existingToken.userId,
        family: existingToken.family,
      });
      throw new UnauthorizedError('Refresh token reuse detected. All sessions revoked.');
    }

    if (existingToken.isExpired) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    const user = await this.userRepository.findById(existingToken.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const newRefreshToken = this.tokenService.generateRefreshToken();

    await this.refreshTokenRepository.revokeByToken(dto.refreshToken, newRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      id: uuidv4(),
      token: newRefreshToken,
      userId: user.id,
      family: existingToken.family,
      expiresAt,
      revokedAt: null,
      replacedByToken: null,
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.tokenService.generateAccessToken(payload);

    return { accessToken, refreshToken: newRefreshToken };
  }
}
