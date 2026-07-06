import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VerifyEmailUseCase } from '../../../../../src/application/use-cases/auth/verify-email.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { PrismaEmailVerificationTokenRepository } from '../../../../../src/infrastructure/database/repositories/prisma-email-verification-token.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('VerifyEmailUseCase', () => {
  let useCase: VerifyEmailUseCase;
  let userRepository: IUserRepository;
  let emailVerificationTokenRepository: PrismaEmailVerificationTokenRepository;
  const now = new Date();

  const unverifiedUser = new User({
    id: 'user-id',
    email: 'test@example.com',
    passwordHash: 'hashed',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: null,
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
      update: vi.fn().mockResolvedValue(unverifiedUser),
      delete: vi.fn(),
      existsByEmail: vi.fn(),
    };
    emailVerificationTokenRepository = {
      create: vi.fn(),
      findByToken: vi.fn(),
      markUsed: vi.fn(),
      invalidateAllForUser: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaEmailVerificationTokenRepository;
    useCase = new VerifyEmailUseCase(userRepository, emailVerificationTokenRepository);
  });

  it('should verify the email with a valid, unexpired, unused token', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(validToken);
    vi.mocked(userRepository.findById).mockResolvedValue(unverifiedUser);

    await useCase.execute({ token: 'real-random-token' });

    expect(userRepository.update).toHaveBeenCalledWith('user-id', { emailVerifiedAt: expect.any(Date) });
    expect(emailVerificationTokenRepository.invalidateAllForUser).toHaveBeenCalledWith('user-id');
  });

  it('regression: should reject a raw user ID passed as the token (closed unverified-email exploit)', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(null);

    await expect(useCase.execute({ token: 'user-id' })).rejects.toThrow(UnauthorizedError);

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should reject an expired token', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue({
      ...validToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(useCase.execute({ token: 'real-random-token' })).rejects.toThrow(UnauthorizedError);
  });

  it('should reject an already-used token (single-use enforcement)', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue({
      ...validToken,
      usedAt: new Date(),
    });

    await expect(useCase.execute({ token: 'real-random-token' })).rejects.toThrow(UnauthorizedError);
  });

  it('should throw NotFoundError if the token references a user that no longer exists', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(validToken);
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute({ token: 'real-random-token' })).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError if the email is already verified', async () => {
    vi.mocked(emailVerificationTokenRepository.findByToken).mockResolvedValue(validToken);
    vi.mocked(userRepository.findById).mockResolvedValue(
      new User({ ...unverifiedUser, emailVerifiedAt: now }),
    );

    await expect(useCase.execute({ token: 'real-random-token' })).rejects.toThrow(ValidationError);
  });
});
