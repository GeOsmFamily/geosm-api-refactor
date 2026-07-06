import { v4 as uuidv4 } from 'uuid';
import { RegisterDTO, UserProfileDTO } from '../../dtos/auth.dto.js';
import { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { IPasswordService } from '../../services/password.service.js';
import { IEmailService } from '../../services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { ConflictError } from '../../../domain/errors/conflict.error.js';
import { Role } from '../../../domain/enums.js';
import { Email } from '../../../domain/value-objects/email.vo.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RegisterUseCase');
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export class RegisterUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: IPasswordService,
    private readonly emailService: IEmailService,
    private readonly emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository,
  ) {}

  async execute(dto: RegisterDTO): Promise<UserProfileDTO> {
    const email = Email.create(dto.email);

    const existingUser = await this.userRepository.existsByEmail(email.value);
    if (existingUser) {
      logger.warn('Registration rejected: email already in use', { email: email.value });
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.userRepository.create({
      id: uuidv4(),
      email: email.value,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatar: null,
      role: Role.VIEWER,
      isActive: true,
      emailVerifiedAt: null,
      lastLoginAt: null,
    });

    const verificationToken = uuidv4();
    await this.emailVerificationTokenRepository.create({
      id: uuidv4(),
      token: verificationToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    });
    await this.emailService.sendVerificationEmail(user.email, verificationToken);
    logger.info('User registered', { userId: user.id });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      isActive: user.isActive,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
