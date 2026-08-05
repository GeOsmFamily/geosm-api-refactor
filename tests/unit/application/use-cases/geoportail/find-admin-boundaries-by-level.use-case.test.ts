import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FindAdminBoundariesByLevelUseCase } from '../../../../../src/application/use-cases/geoportail/find-admin-boundaries-by-level.use-case.js';
import type { IInstanceRepository } from '../../../../../src/domain/repositories/instance.repository.js';
import { Instance } from '../../../../../src/domain/entities/instance.entity.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import type { PrismaClient } from '@prisma/client';

describe('FindAdminBoundariesByLevelUseCase', () => {
  let instanceRepository: IInstanceRepository;
  const now = new Date();

  const makeInstance = (overrides: Partial<ReturnType<typeof baseProps>> = {}) =>
    new Instance({ ...baseProps(), ...overrides });

  function baseProps() {
    return {
      id: 'inst-1',
      name: 'Yaounde',
      slug: 'yaounde',
      description: null,
      logo: null,
      bbox: null as number[] | null,
      centerLat: null,
      centerLon: null,
      defaultZoom: 6,
      boundaryTable: 'admin_boundaries',
      boundaryId: 606,
      boundaryGeomCol: 'geom',
      adminLevel: 7,
      parentInstanceId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  beforeEach(() => {
    instanceRepository = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findInstanceUsers: vi.fn(),
    } as unknown as IInstanceRepository;
  });

  it('should query admin_boundaries using boundaryTable/boundaryId when configured', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(makeInstance());
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        { id: 4, name: 'Yaounde I', geojson: { type: 'Polygon', coordinates: [] } },
      ]),
    } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    const result = await useCase.execute('inst-1');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Yaounde I');
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = 606'),
      7,
    );
  });

  it('should fall back to bbox when no boundaryTable/boundaryId is configured', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(
      makeInstance({ boundaryTable: null, boundaryId: null, bbox: [8.4, 1.6, 16.2, 13.1] }),
    );
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    await useCase.execute('inst-1');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('ST_MakeEnvelope(8.4, 1.6, 16.2, 13.1)'),
      7,
    );
  });

  it('should use the explicit adminLevel override instead of instance.adminLevel', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(makeInstance({ adminLevel: 7 }));
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    await useCase.execute('inst-1', 8);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.any(String), 8);
  });

  it('should throw NotFoundError when the instance does not exist', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(null);
    const mockPrisma = { $queryRawUnsafe: vi.fn() } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw ValidationError when no adminLevel is available anywhere', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(makeInstance({ adminLevel: null }));
    const mockPrisma = { $queryRawUnsafe: vi.fn() } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    await expect(useCase.execute('inst-1')).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when the instance has neither boundary nor bbox', async () => {
    vi.mocked(instanceRepository.findById).mockResolvedValue(
      makeInstance({ boundaryTable: null, boundaryId: null, bbox: null }),
    );
    const mockPrisma = { $queryRawUnsafe: vi.fn() } as unknown as PrismaClient;

    const useCase = new FindAdminBoundariesByLevelUseCase(mockPrisma, instanceRepository);
    await expect(useCase.execute('inst-1')).rejects.toThrow(ValidationError);
  });
});
