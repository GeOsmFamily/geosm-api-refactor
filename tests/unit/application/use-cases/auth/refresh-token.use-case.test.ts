import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshTokenUseCase } from '../../../../../src/application/use-cases/auth/refresh-token.use-case.js';
import { UnauthorizedError } from '../../../../../src/domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import type { ITokenService } from '../../../../../src/application/services/token.service.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('RefreshTokenUseCase', () => {
  let useCase: RefreshTokenUseCase;
  let userRepository: IUserRepository;
  let refreshTokenRepository: IRefreshTokenRepository;
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

  const validExistingToken = {
    id: 'rt-id',
    token: 'old-refresh-token',
    userId: 'user-id',
    family: 'family-1',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    revokedAt: null,
    replacedByToken: null,
    isRevoked: false,
    isExpired: false,
  };

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
      revokeByToken: vi.fn().mockResolvedValue(undefined),
      revokeAllByFamily: vi.fn().mockResolvedValue(undefined),
      revokeAllByUserId: vi.fn(),
      deleteExpired: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('new-access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('new-refresh-token'),
      verifyAccessToken: vi.fn(),
      generateTokenPair: vi.fn(),
    };
    useCase = new RefreshTokenUseCase(userRepository, refreshTokenRepository, tokenService);
  });

  it('should rotate the refresh token and issue a new access token', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue(validExistingToken as never);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

    const result = await useCase.execute({ refreshToken: 'old-refresh-token' });

    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(refreshTokenRepository.revokeByToken).toHaveBeenCalledWith('old-refresh-token', 'new-refresh-token');
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ family: 'family-1', userId: 'user-id' }),
    );
  });

  it('should throw UnauthorizedError for an unknown token', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'unknown' })).rejects.toThrow(UnauthorizedError);
  });

  it('security: should revoke the entire token family on reuse of a revoked token (replay/theft detection)', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue({
      ...validExistingToken,
      isRevoked: true,
    } as never);

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toThrow(UnauthorizedError);

    expect(refreshTokenRepository.revokeAllByFamily).toHaveBeenCalledWith('family-1');
  });

  it('should reject an expired token', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue({
      ...validExistingToken,
      isExpired: true,
    } as never);

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toThrow(UnauthorizedError);
  });

  it('should reject if the user no longer exists or is inactive', async () => {
    vi.mocked(refreshTokenRepository.findByToken).mockResolvedValue(validExistingToken as never);
    vi.mocked(userRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute({ refreshToken: 'old-refresh-token' })).rejects.toThrow(UnauthorizedError);
  });
});
