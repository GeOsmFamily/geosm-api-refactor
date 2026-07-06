import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnlinkOsmAccountUseCase } from '../../../../../src/application/use-cases/auth/unlink-osm-account.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { PrismaOsmProfileRepository } from '../../../../../src/infrastructure/database/repositories/prisma-osm-profile.repository.js';

describe('UnlinkOsmAccountUseCase', () => {
  let useCase: UnlinkOsmAccountUseCase;
  let osmProfileRepository: PrismaOsmProfileRepository;
  const now = new Date();

  beforeEach(() => {
    osmProfileRepository = {
      findByOsmUserId: vi.fn(),
      findByUserId: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaOsmProfileRepository;
    useCase = new UnlinkOsmAccountUseCase(osmProfileRepository);
  });

  it('should delete the OSM profile for the given user', async () => {
    vi.mocked(osmProfileRepository.findByUserId).mockResolvedValue({
      id: 'profile-id',
      userId: 'user-id',
      osmUserId: 1n,
      displayName: 'Jane',
      avatarUrl: null,
      osmAccountCreatedAt: now,
      changesetCount: 0,
      homeLat: null,
      homeLon: null,
      accessTokenEncrypted: 'iv:tag:cipher',
      linkedAt: now,
      updatedAt: now,
    });

    await useCase.execute('user-id');

    expect(osmProfileRepository.delete).toHaveBeenCalledWith('user-id');
  });

  it('should throw NotFoundError if no OSM profile is linked', async () => {
    vi.mocked(osmProfileRepository.findByUserId).mockResolvedValue(null);

    await expect(useCase.execute('user-id')).rejects.toThrow(NotFoundError);
    expect(osmProfileRepository.delete).not.toHaveBeenCalled();
  });
});
