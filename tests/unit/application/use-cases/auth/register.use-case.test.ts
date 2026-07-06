import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUseCase } from '../../../../../src/application/use-cases/auth/register.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { IEmailService } from '../../../../../src/application/services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../../../src/infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: IUserRepository;
  let passwordService: IPasswordService;
  let emailService: IEmailService;
  let emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository;

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      verify: vi.fn(),
    };
    emailService = {
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: vi.fn(),
      sendWelcomeEmail: vi.fn(),
    };
    emailVerificationTokenRepository = {
      create: vi.fn().mockResolvedValue({}),
      findByToken: vi.fn(),
      markUsed: vi.fn(),
      invalidateAllForUser: vi.fn(),
    } as unknown as PrismaEmailVerificationTokenRepository;
    useCase = new RegisterUseCase(userRepository, passwordService, emailService, emailVerificationTokenRepository);
  });

  it('should register a new user successfully', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(false);
    const now = new Date();
    vi.mocked(userRepository.create).mockResolvedValue(
      new User({
        id: 'test-id',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
        role: Role.VIEWER,
        isActive: true,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(result.email).toBe('test@example.com');
    expect(result.role).toBe(Role.VIEWER);
    expect(passwordService.hash).toHaveBeenCalledWith('password123');
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();
  });

  it('should store the verification token before emailing it (regression: token used to be discarded, letting anyone verify by guessing a user ID)', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(false);
    const now = new Date();
    vi.mocked(userRepository.create).mockResolvedValue(
      new User({
        id: 'test-id',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        avatar: null,
        role: Role.VIEWER,
        isActive: true,
        emailVerifiedAt: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    );

    await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(emailVerificationTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'test-id', expiresAt: expect.any(Date) }),
    );
    const storedToken = vi.mocked(emailVerificationTokenRepository.create).mock.calls[0][0].token;
    const emailedToken = vi.mocked(emailService.sendVerificationEmail).mock.calls[0][1];
    expect(storedToken).toBe(emailedToken);
    expect(storedToken).not.toBe('test-id');
  });

  it('should throw ConflictError if email already exists', async () => {
    vi.mocked(userRepository.existsByEmail).mockResolvedValue(true);

    await expect(
      useCase.execute({
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      }),
    ).rejects.toThrow(ConflictError);
  });
});
