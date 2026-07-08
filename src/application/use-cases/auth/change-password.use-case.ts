import { ChangePasswordDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ChangePasswordUseCase');

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(userId: string, dto: ChangePasswordDTO): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const isCurrentPasswordValid = await this.passwordService.verify(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      logger.warn('Change password rejected: wrong current password', { userId });
      throw new UnauthorizedError('Current password is incorrect');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.userRepository.update(userId, { passwordHash });
    await this.refreshTokenRepository.revokeAllByUserId(userId);
    logger.info('Password changed, all sessions revoked', { userId });
  }
}
