import { v4 as uuidv4 } from 'uuid';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IEmailService } from '../../services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { TooManyRequestsError } from '../../../domain/errors/too-many-requests.error.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { VERIFICATION_TOKEN_TTL_MS } from './register.use-case.js';

const logger = createChildLogger('ResendVerificationUseCase');

/** Delai minimum entre deux envois du mail de verification (RG-A-04). */
export const RESEND_COOLDOWN_SECONDS = 60;

/** Renvoie le mail de verification d'un compte connecte, au plus une fois par minute. */
export class ResendVerificationUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly tokenRepository: PrismaEmailVerificationTokenRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async execute(userId: string, lang?: string): Promise<{ retryAfterSeconds: number }> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', userId);
    if (user.emailVerifiedAt) throw new ValidationError('Email is already verified');

    const last = await this.tokenRepository.findLatestByUser(userId);
    if (last) {
      const elapsed = Math.floor((this.now() - last.createdAt.getTime()) / 1000);
      const remaining = RESEND_COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        throw new TooManyRequestsError(
          'Un email de verification a deja ete envoye recemment',
          'VERIFICATION_RESEND_COOLDOWN',
          remaining,
        );
      }
    }

    // Un seul lien valide a la fois : l'ancien est invalide avant d'en emettre un nouveau.
    await this.tokenRepository.invalidateAllForUser(userId);
    const token = uuidv4();
    await this.tokenRepository.create({
      id: uuidv4(),
      token,
      userId,
      expiresAt: new Date(this.now() + VERIFICATION_TOKEN_TTL_MS),
    });
    await this.emailService.sendVerificationEmail(user.email, token, lang);
    logger.info('Verification email re-sent', { userId });
    return { retryAfterSeconds: RESEND_COOLDOWN_SECONDS };
  }
}
