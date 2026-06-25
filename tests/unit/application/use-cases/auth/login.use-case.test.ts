import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginUseCase } from '../../../../../src/application/use-cases/auth/login.use-case.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { ITokenService } from '../../../../../src/application/services/token.service.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let userRepository: IUserRepository;
  let refreshTokenRepository: IRefreshTokenRepository;
  let passwordService: IPasswordService;
  let tokenService: ITokenService;
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
      update: vi.fn().mockResolvedValue(mockUser),
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
      hash: vi.fn(),
      verify: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      verifyAccessToken: vi.fn(),
      generateTokenPair: vi.fn(),
    };
    useCase = new LoginUseCase(userRepository, refreshTokenRepository, passwordService, tokenService);
  });

  it('should login successfully with valid credentials', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordService.verify).mockResolvedValue(true);

    const result = await useCase.execute({ email: 'test@example.com', password: 'password' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(refreshTokenRepository.create).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError for non-existent user', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'noone@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError for wrong password', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordService.verify).mockResolvedValue(false);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'wrong' }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('should throw UnauthorizedError for inactive user', async () => {
    const inactiveUser = new User({ ...mockUser, isActive: false });
    vi.mocked(userRepository.findByEmail).mockResolvedValue(inactiveUser);

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
