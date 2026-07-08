import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OsmLoginUseCase } from '../../../../../src/application/use-cases/auth/osm-login.use-case.js';
import type { IUserRepository } from '../../../../../src/domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../../../src/domain/repositories/refresh-token.repository.js';
import type { IPasswordService } from '../../../../../src/application/services/password.service.js';
import type { ITokenService } from '../../../../../src/application/services/token.service.js';
import type { OsmOAuthService, OsmUserDetails } from '../../../../../src/infrastructure/external-apis/osm-oauth.service.js';
import type { PrismaOsmProfileRepository } from '../../../../../src/infrastructure/database/repositories/prisma-osm-profile.repository.js';
import { Role } from '../../../../../src/domain/enums.js';
import { User } from '../../../../../src/domain/entities/user.entity.js';

describe('OsmLoginUseCase', () => {
  let useCase: OsmLoginUseCase;
  let osmOAuthService: OsmOAuthService;
  let osmProfileRepository: PrismaOsmProfileRepository;
  let userRepository: IUserRepository;
  let refreshTokenRepository: IRefreshTokenRepository;
  let passwordService: IPasswordService;
  let tokenService: ITokenService;
  const now = new Date();

  const osmDetails: OsmUserDetails = {
    osmUserId: 12345,
    displayName: 'Jane OSM',
    email: 'jane@example.com',
    avatarUrl: 'https://example.com/avatar.png',
    accountCreatedAt: now,
    changesetCount: 42,
    homeLat: null,
    homeLon: null,
  };

  const mockUser = new User({
    id: 'user-id',
    email: 'jane@example.com',
    passwordHash: 'hashed',
    firstName: 'Jane',
    lastName: 'OSM',
    avatar: null,
    role: Role.VIEWER,
    isActive: true,
    emailVerifiedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  });

  beforeEach(() => {
    osmOAuthService = {
      exchangeCodeForToken: vi.fn().mockResolvedValue('osm-access-token'),
      getUserDetails: vi.fn().mockResolvedValue(osmDetails),
    } as unknown as OsmOAuthService;
    osmProfileRepository = {
      findByOsmUserId: vi.fn(),
      findByUserId: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
    } as unknown as PrismaOsmProfileRepository;
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
      hash: vi.fn().mockResolvedValue('random-unusable-hash'),
      verify: vi.fn(),
    };
    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('jwt-access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('jwt-refresh-token'),
      verifyAccessToken: vi.fn(),
      generateTokenPair: vi.fn(),
    };
    useCase = new OsmLoginUseCase(
      osmOAuthService,
      osmProfileRepository,
      userRepository,
      refreshTokenRepository,
      passwordService,
      tokenService,
    );
  });

  it('should create a new local VIEWER account on first OSM login', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue(null);
    vi.mocked(userRepository.create).mockResolvedValue(mockUser);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

    const result = await useCase.execute('auth-code');

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', role: Role.VIEWER }),
    );
    expect(osmProfileRepository.upsert).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 'user-id', osmUserId: 12345n }),
    );
    expect(result.accessToken).toBe('jwt-access-token');
    expect(result.refreshToken).toBe('jwt-refresh-token');
  });

  it('should sign in the existing linked user without creating a duplicate account', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue({
      id: 'profile-id',
      userId: 'user-id',
      osmUserId: 12345n,
      displayName: 'Jane OSM',
      avatarUrl: null,
      osmAccountCreatedAt: now,
      changesetCount: 40,
      homeLat: null,
      homeLon: null,
      accessTokenEncrypted: 'iv:tag:cipher',
      linkedAt: now,
      updatedAt: now,
    });
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

    const result = await useCase.execute('auth-code');

    expect(userRepository.create).not.toHaveBeenCalled();
    expect(result.accessToken).toBe('jwt-access-token');
  });

  it('should never store the OSM access token unencrypted', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue(null);
    vi.mocked(userRepository.create).mockResolvedValue(mockUser);
    vi.mocked(userRepository.findById).mockResolvedValue(mockUser);

    await useCase.execute('auth-code');

    const upsertData = vi.mocked(osmProfileRepository.upsert).mock.calls[0][1];
    expect(upsertData.accessTokenEncrypted).not.toBe('osm-access-token');
    expect(upsertData.accessTokenEncrypted.split(':')).toHaveLength(3);
  });
});
