import { VerifyEmailDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { UnauthorizedError } from '../../../domain/errors/unauthorized.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('VerifyEmailUseCase');

/**
 * Correctif sécurité : `dto.token` doit désormais correspondre à un EmailVerificationToken réel,
 * non expiré et non déjà utilisé - voir RegisterUseCase. La version précédente traitait
 * `dto.token` comme l'ID utilisateur directement ("Phase 1"), permettant à quiconque connaissant
 * l'UUID d'un compte de marquer son email comme vérifié sans jamais avoir eu accès à la boîte
 * mail - contournant l'intérêt même de la vérification.
 */
export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository,
  ) {}

  async execute(dto: VerifyEmailDTO): Promise<void> {
    const verificationToken = await this.emailVerificationTokenRepository.findByToken(dto.token);
    if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
      logger.warn('Verify-email rejected: invalid, used, or expired token');
      throw new UnauthorizedError('Invalid or expired verification token');
    }

    const user = await this.userRepository.findById(verificationToken.userId);
    if (!user) {
      throw new NotFoundError('User');
    }
    if (user.emailVerifiedAt) {
      throw new ValidationError('Email is already verified');
    }

    await this.userRepository.update(user.id, { emailVerifiedAt: new Date() });
    // Usage unique : invalide ce token ET tout autre token en attente pour cet utilisateur.
    await this.emailVerificationTokenRepository.invalidateAllForUser(user.id);
    logger.info('Email verified', { userId: user.id });
  }
}
