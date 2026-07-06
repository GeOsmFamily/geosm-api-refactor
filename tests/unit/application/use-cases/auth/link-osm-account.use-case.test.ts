import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkOsmAccountUseCase } from '../../../../../src/application/use-cases/auth/link-osm-account.use-case.js';
import { ConflictError } from '../../../../../src/domain/errors/conflict.error.js';
import type { OsmOAuthService, OsmUserDetails } from '../../../../../src/infrastructure/external-apis/osm-oauth.service.js';
import type { PrismaOsmProfileRepository } from '../../../../../src/infrastructure/database/repositories/prisma-osm-profile.repository.js';

describe('LinkOsmAccountUseCase', () => {
  let useCase: LinkOsmAccountUseCase;
  let osmOAuthService: OsmOAuthService;
  let osmProfileRepository: PrismaOsmProfileRepository;
  const now = new Date();

  const osmDetails: OsmUserDetails = {
    osmUserId: 999,
    displayName: 'Jane OSM',
    email: 'jane@example.com',
    avatarUrl: null,
    accountCreatedAt: now,
    changesetCount: 10,
    homeLat: null,
    homeLon: null,
  };

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
    useCase = new LinkOsmAccountUseCase(osmOAuthService, osmProfileRepository);
  });

  it('should link the OSM account to the currently authenticated user', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue(null);

    await useCase.execute('current-user-id', 'auth-code');

    expect(osmProfileRepository.upsert).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: 'current-user-id', osmUserId: 999n }),
    );
  });

  it('should throw ConflictError if the OSM account is already linked to a different GeOSM account', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue({
      id: 'profile-id',
      userId: 'someone-else',
      osmUserId: 999n,
      displayName: 'Jane OSM',
      avatarUrl: null,
      osmAccountCreatedAt: now,
      changesetCount: 10,
      homeLat: null,
      homeLon: null,
      accessTokenEncrypted: 'iv:tag:cipher',
      linkedAt: now,
      updatedAt: now,
    });

    await expect(useCase.execute('current-user-id', 'auth-code')).rejects.toThrow(ConflictError);
    expect(osmProfileRepository.upsert).not.toHaveBeenCalled();
  });

  it('should allow re-linking (upsert) if the OSM account is already linked to the same user', async () => {
    vi.mocked(osmProfileRepository.findByOsmUserId).mockResolvedValue({
      id: 'profile-id',
      userId: 'current-user-id',
      osmUserId: 999n,
      displayName: 'Jane OSM',
      avatarUrl: null,
      osmAccountCreatedAt: now,
      changesetCount: 10,
      homeLat: null,
      homeLon: null,
      accessTokenEncrypted: 'iv:tag:cipher',
      linkedAt: now,
      updatedAt: now,
    });

    await useCase.execute('current-user-id', 'auth-code');

    expect(osmProfileRepository.upsert).toHaveBeenCalled();
  });
});
