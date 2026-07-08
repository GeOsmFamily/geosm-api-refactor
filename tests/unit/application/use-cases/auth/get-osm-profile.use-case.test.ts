import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetOsmProfileUseCase } from '../../../../../src/application/use-cases/auth/get-osm-profile.use-case.js';
import type { PrismaOsmProfileRepository } from '../../../../../src/infrastructure/database/repositories/prisma-osm-profile.repository.js';

describe('GetOsmProfileUseCase', () => {
  let useCase: GetOsmProfileUseCase;
  let osmProfileRepository: PrismaOsmProfileRepository;
  const now = new Date();

  beforeEach(() => {
    osmProfileRepository = {
      findByOsmUserId: vi.fn(),
      findByUserId: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    } as unknown as PrismaOsmProfileRepository;
    useCase = new GetOsmProfileUseCase(osmProfileRepository);
  });

  it('should return the mapped profile DTO without leaking the encrypted access token', async () => {
    vi.mocked(osmProfileRepository.findByUserId).mockResolvedValue({
      id: 'profile-id',
      userId: 'user-id',
      osmUserId: 123456789012345n,
      displayName: 'Jane OSM',
      avatarUrl: 'https://example.com/a.png',
      osmAccountCreatedAt: now,
      changesetCount: 7,
      homeLat: null,
      homeLon: null,
      accessTokenEncrypted: 'iv:tag:cipher',
      linkedAt: now,
      updatedAt: now,
    });

    const result = await useCase.execute('user-id');

    expect(result).toEqual({
      osmUserId: '123456789012345',
      displayName: 'Jane OSM',
      avatarUrl: 'https://example.com/a.png',
      osmAccountCreatedAt: now,
      changesetCount: 7,
      linkedAt: now,
    });
    expect(result).not.toHaveProperty('accessTokenEncrypted');
  });

  it('should return null if no OSM profile is linked', async () => {
    vi.mocked(osmProfileRepository.findByUserId).mockResolvedValue(null);

    const result = await useCase.execute('user-id');

    expect(result).toBeNull();
  });
});
