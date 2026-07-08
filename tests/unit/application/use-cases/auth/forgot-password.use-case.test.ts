import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForgotPasswordUseCase } from '../../../../../src/application/use-cases/auth/forgot-password.use-case.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IEmailService } from '../../../../../src/application/services/email.service.js';
import type { PrismaPasswordResetTokenRepository } from '../../../../../src/infrastructure/database/repositories/prisma-password-reset-token.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('ForgotPasswordUseCase', () => {
  let useCase: ForgotPasswordUseCase;
  let userRepository: IUserRepository;
  let emailService: IEmailService;
  let passwordResetTokenRepository: PrismaPasswordResetTokenRepository;
  const now = new Date();

  const mockUser = new User({
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: now,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    emailService = {
      sendVerificationEmail: vi.fn(),
      sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: vi.fn(),
    };
    passwordResetTokenRepository = {
      create: vi.fn().mockResolvedValue({}),
      findByToken: vi.fn(),
      markUsed: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaPasswordResetTokenRepository;
    useCase = new ForgotPasswordUseCase(userRepository, emailService, passwordResetTokenRepository);
  });

  it('should generate, store, and email a real token (not the user id) for an existing user', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);

    await useCase.execute({ email: 'test@example.com' });

    expect(passwordResetTokenRepository.invalidateAllForUser).toHaveBeenCalledWith('user-id');
    expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', expiresAt: expect.any(Date) }),
    );
    const storedToken = vi.mocked(passwordResetTokenRepository.create).mock.calls[0][0].token;
    const emailedToken = vi.mocked(emailService.sendPasswordResetEmail).mock.calls[0][1];
    expect(storedToken).toBe(emailedToken);
    expect(storedToken).not.toBe('user-id');
  });

  it('should silently no-op for a non-existent user (no email enumeration)', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(useCase.execute({ email: 'noone@example.com' })).resolves.toBeUndefined();

    expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('should invalidate previous pending tokens before issuing a new one', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);

    await useCase.execute({ email: 'test@example.com' });

    expect(passwordResetTokenRepository.invalidateAllForUser).toHaveBeenCalled();
    const invalidateOrder = vi.mocked(passwordResetTokenRepository.invalidateAllForUser).mock.invocationCallOrder[0];
    const createOrder = vi.mocked(passwordResetTokenRepository.create).mock.invocationCallOrder[0];
    expect(invalidateOrder).toBeLessThan(createOrder);
  });
});
