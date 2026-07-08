import { LogoutDTO } from '../../dtos/auth.dto.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('LogoutUseCase');

export class LogoutUseCase {
  constructor(private readonly refreshTokenRepository: IRefreshTokenRepository) {}

  async execute(dto: LogoutDTO): Promise<void> {
    const token = await this.refreshTokenRepository.findByToken(dto.refreshToken);
    if (token) {
      await this.refreshTokenRepository.revokeAllByFamily(token.family);
      logger.info('Logout: session family revoked', { userId: token.userId });
    }
  }
}
