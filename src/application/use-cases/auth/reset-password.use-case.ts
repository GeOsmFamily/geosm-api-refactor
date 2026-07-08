import { ResetPasswordDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { PrismaPasswordResetTokenRepository } from '../../../infrastructure/database/repositories/prisma-password-reset-token.repository.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ResetPasswordUseCase');

/**
 * Correctif sécurité : `dto.token` doit désormais correspondre à un PasswordResetToken réel,
 * non expiré et non déjà utilisé - voir ForgotPasswordUseCase. La version précédente traitait
 * `dto.token` comme l'ID utilisateur directement ("Phase 1, token is the user ID"), permettant
 * à quiconque connaissant l'UUID d'un compte de réinitialiser son mot de passe sans jamais
 * avoir reçu de token par email.
 */
export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly passwordResetTokenRepository: PrismaPasswordResetTokenRepository,
  ) {}

  async execute(dto: ResetPasswordDTO): Promise<void> {
    const resetToken = await this.passwordResetTokenRepository.findByToken(dto.token);
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      // Événement de sécurité à surveiller : un volume anormal peut indiquer une tentative
      // d'exploitation (deviner/réutiliser un UUID en guise de token, cf. la faille corrigée).
      logger.warn('Reset-password rejected: invalid, used, or expired token');
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = await this.userRepository.findById(resetToken.userId);
    if (!user) {
      logger.error('Reset token references a user that no longer exists', {
        userId: resetToken.userId,
      });
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    await this.userRepository.update(user.id, { passwordHash });
    await this.refreshTokenRepository.revokeAllByUserId(user.id);
    // Usage unique : invalide ce token ET tout autre token en attente pour cet utilisateur
    // (au cas où plusieurs demandes de reset auraient été faites).
    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);
    logger.info('Password reset successful, all sessions revoked', { userId: user.id });
  }
}
