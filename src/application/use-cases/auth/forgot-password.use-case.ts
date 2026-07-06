import { v4 as uuidv4 } from 'uuid';
import { ForgotPasswordDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IEmailService } from '../../services/email.service.js';
import type { PrismaPasswordResetTokenRepository } from '../../../infrastructure/database/repositories/prisma-password-reset-token.repository.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ForgotPasswordUseCase');
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h

/**
 * Correctif sécurité : génère désormais un vrai token aléatoire à usage unique, STOCKÉ (voir
 * PasswordResetToken), avant de l'envoyer par email. La version précédente générait un token
 * mais ne le stockait jamais nulle part - ResetPasswordUseCase acceptait alors n'importe quel
 * ID utilisateur comme "token" valide (faille de prise de contrôle de compte).
 */
export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly passwordResetTokenRepository: PrismaPasswordResetTokenRepository,
  ) {}

  async execute(dto: ForgotPasswordDTO): Promise<void> {
    const user = await this.userRepository.findByEmail(dto.email);
    // Toujours renvoyer un succès (silencieux si l'utilisateur n'existe pas) pour éviter
    // l'énumération d'emails.
    if (!user) {
      return;
    }

    // Invalide les tokens précédents non utilisés avant d'en émettre un nouveau - un seul
    // token valide à la fois par utilisateur.
    await this.passwordResetTokenRepository.invalidateAllForUser(user.id);

    const resetToken = uuidv4();
    await this.passwordResetTokenRepository.create({
      id: uuidv4(),
      token: resetToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    logger.info('Password reset requested', { userId: user.id });
  }
}
