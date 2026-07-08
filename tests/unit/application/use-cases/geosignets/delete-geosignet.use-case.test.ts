import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteGeosignetUseCase } from '../../../../../src/application/use-cases/geosignets/delete-geosignet.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import type { PrismaGeosignetRepository } from '../../../../../src/infrastructure/database/repositories/prisma-geosignet.repository.js';

describe('DeleteGeosignetUseCase', () => {
  let useCase: DeleteGeosignetUseCase;
  let geosignetRepository: PrismaGeosignetRepository;
  const now = new Date();

  const ownedGeosignet = {
    id: 'geosignet-id',
    userId: 'owner-id',
    name: 'My bookmark',
    center: [0, 0],
    zoom: 5,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    geosignetRepository = {
      findById: vi.fn(),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as PrismaGeosignetRepository;
    useCase = new DeleteGeosignetUseCase(geosignetRepository);
  });

  it('should delete the geosignet when the requester is the owner', async () => {
    vi.mocked(geosignetRepository.findById).mockResolvedValue(ownedGeosignet);

    await useCase.execute('owner-id', 'geosignet-id');

    expect(geosignetRepository.delete).toHaveBeenCalledWith('geosignet-id');
  });

  it('regression (IDOR): should reject deletion by a user who does not own the geosignet', async () => {
    vi.mocked(geosignetRepository.findById).mockResolvedValue(ownedGeosignet);

    await expect(useCase.execute('someone-else-id', 'geosignet-id')).rejects.toThrow(ForbiddenError);
    expect(geosignetRepository.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError if the geosignet does not exist', async () => {
    vi.mocked(geosignetRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute('owner-id', 'missing-id')).rejects.toThrow(NotFoundError);
    expect(geosignetRepository.delete).not.toHaveBeenCalled();
  });
});
