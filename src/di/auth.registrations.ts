import { asFunction, Lifetime } from 'awilix';
import type { IUserRepository } from '../domain/repositories/user.repository.js';
import type { IEmailService } from '../application/services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { ResendVerificationUseCase } from '../application/use-cases/auth/resend-verification.use-case.js';
import { CompleteProfileUseCase } from '../application/use-cases/auth/complete-profile.use-case.js';
import type { DomainRegistration } from './domain-registrations.js';

interface AuthCradle {
  userRepository: IUserRepository;
  emailService: IEmailService;
  emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository;
}

/** Parcours d'inscription de GeOsm Family (chantier A) : renvoi du mail, complement OSM. */
export const authRegistrations: DomainRegistration = () => ({
  resendVerificationUseCase: asFunction(
    (c: AuthCradle) =>
      new ResendVerificationUseCase(
        c.userRepository,
        c.emailService,
        c.emailVerificationTokenRepository,
      ),
    { lifetime: Lifetime.SCOPED },
  ),
  completeProfileUseCase: asFunction(
    (c: AuthCradle) =>
      new CompleteProfileUseCase(
        c.userRepository,
        c.emailService,
        c.emailVerificationTokenRepository,
      ),
    { lifetime: Lifetime.SCOPED },
  ),
});
