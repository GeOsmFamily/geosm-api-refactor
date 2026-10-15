import { v4 as uuidv4 } from 'uuid';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IEmailService } from '../../services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import { VERIFICATION_TOKEN_TTL_MS } from './register.use-case.js';

const logger = createChildLogger('CompleteProfileUseCase');

export interface CompleteProfileDTO {
  firstName: string;
  lastName: string;
  email?: string;
}

/**
 * Ecran de complement du premier login OpenStreetMap (RG-A-09) : l'utilisateur confirme ou
 * corrige le prenom, le nom et l'email recuperes depuis OSM. Un nouvel email n'est pas verifie
 * et declenche l'envoi du mail de verification.
 */
export class CompleteProfileUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly tokenRepository: PrismaEmailVerificationTokenRepository,
  ) {}

  async execute(userId: string, dto: CompleteProfileDTO): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError('User', userId);

    let emailChange: { email: string } | null = null;
    if (dto.email !== undefined) {
      const email = Email.create(dto.email).value;
      if (email !== user.email) {
        const other = await this.userRepository.findByEmail(email);
        if (other && other.id !== userId) {
          // RG-A-01 : un email = un compte ; l'utilisateur est invite a lier ses connexions.
          throw new ConflictError('A user with this email already exists');
        }
        emailChange = { email };
      }
    }

    await this.userRepository.update(userId, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      profileCompletionPending: false,
      ...(emailChange ? { email: emailChange.email, emailVerifiedAt: null } : {}),
    });

    if (emailChange) {
      await this.tokenRepository.invalidateAllForUser(userId);
      const token = uuidv4();
      await this.tokenRepository.create({
        id: uuidv4(),
        token,
        userId,
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
      });
      await this.emailService.sendVerificationEmail(emailChange.email, token);
    }
    logger.info('Profile completed', { userId, emailChanged: emailChange !== null });
  }
}
