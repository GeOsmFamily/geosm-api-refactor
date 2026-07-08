import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterUseCase } from '../../../../../src/application/use-cases/auth/register.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { ITokenService } from '../../../../../src/application/services/token.service.js';
import type { IEmailService } from '../../../../../src/application/services/email.service.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../../../src/infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('RegisterUseCase', () => {
  let useCase: RegisterUseCase;
  let userRepository: IUserRepository;
  let refreshTokenRepository: IRefreshTokenRepository;
  let passwordService: IPasswordService;
  let tokenService: ITokenService;
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
    refreshTokenRepository = {
      findByToken: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
      revokeByToken: vi.fn(),
      revokeAllByFamily: vi.fn(),
      revokeAllByUserId: vi.fn(),
      deleteExpired: vi.fn(),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('hashed-password'),
      verify: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      verifyAccessToken: vi.fn(),
      generateTokenPair: vi.fn(),
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
    useCase = new RegisterUseCase(
      userRepository,
      refreshTokenRepository,
      passwordService,
      tokenService,
      emailService,
      emailVerificationTokenRepository,
    );
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

    // Renvoie des tokens (comme LoginUseCase), pas un profil - voir project_geosm_auth_flow_fixes :
    // l'inscription connecte immédiatement l'utilisateur, elle n'exigeait déjà pas d'email
    // vérifié pour se connecter ensuite.
    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(passwordService.hash).toHaveBeenCalledWith('password123');
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'test-id' }),
    );
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
