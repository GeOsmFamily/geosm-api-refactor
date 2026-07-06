import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResetPasswordUseCase } from '../../../../../src/application/use-cases/auth/reset-password.use-case.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import type { PrismaPasswordResetTokenRepository } from '../../../../../src/infrastructure/database/repositories/prisma-password-reset-token.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('ResetPasswordUseCase', () => {
  let useCase: ResetPasswordUseCase;
  let userRepository: IUserRepository;
  let passwordService: IPasswordService;
  let refreshTokenRepository: IRefreshTokenRepository;
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

  const validToken = {
    id: 'token-id',
    token: 'real-random-token',
    userId: 'user-id',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: now,
  };

  beforeEach(() => {
    userRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue(mockUser),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    passwordService = {
      hash: vi.fn().mockResolvedValue('new-hashed-password'),
      verify: vi.fn(),
    };
    refreshTokenRepository = {
      findByToken: vi.fn(),
      create: vi.fn(),
      revokeByToken: vi.fn(),
      revokeAllByFamily: vi.fn(),
      revokeAllByUserId: vi.fn().mockResolvedValue(undefined),
      deleteExpired: vi.fn(),
    };
    passwordResetTokenRepository = {
      create: vi.fn(),
      findByToken: vi.fn(),
      markUsed: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaPasswordResetTokenRepository;
    useCase = new ResetPasswordUseCase(userRepository, passwordService, refreshTokenRepository, passwordResetTokenRepository);
  });

  it('should reset the password with a valid, unexpired, unused token', async () => {
    vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue(validToken);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

    await useCase.execute({ token: 'real-random-token', password: 'NewP@ssw0rd1!' });

    expect(userRepository.update).toHaveBeenCalledWith('user-id', { passwordHash: 'new-hashed-password' });
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-id');
    expect(passwordResetTokenRepository.invalidateAllForUser).toHaveBeenCalledWith('user-id');
  });

  it('regression: should reject a raw user ID passed as the token (closed account-takeover exploit)', async () => {
    vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'user-id', password: 'Hacked1!' }),
    ).rejects.toThrow(UnauthorizedError);

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should reject an expired token', async () => {
    vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      useCase.execute({ token: 'real-random-token', password: 'NewP@ssw0rd1!' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should reject an already-used token (single-use enforcement)', async () => {
    vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue({
      ...validToken,
      usedAt: new Date(),
    });

    await expect(
      useCase.execute({ token: 'real-random-token', password: 'NewP@ssw0rd1!' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw if the token references a user that no longer exists', async () => {
    vi.mocked(passwordResetTokenRepository.findByToken).mockResolvedValue(validToken);
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(
      useCase.execute({ token: 'real-random-token', password: 'NewP@ssw0rd1!' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
