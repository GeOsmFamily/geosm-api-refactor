import { describe, it, expect, vi } from 'vitest';
import { GetBoundaryUseCase } from '../../../../../src/application/use-cases/geoportail/get-boundary.use-case.js';
import type { PrismaClient } from '@prisma/client';

describe('GetBoundaryUseCase', () => {
  it('should return boundary detail when found with custom schema and column', async () => {
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'Biyem-Assi',
          adminLevel: 6,
          geojson: { type: 'Polygon', coordinates: [] },
        },
      ]),
    } as unknown as PrismaClient;

    const useCase = new GetBoundaryUseCase(mockPrisma);
    const result = await useCase.execute('osm.admin_boundaries', 1, 'the_geom');

    expect(result).toEqual({
      id: 1,
      name: 'Biyem-Assi',
      adminLevel: 6,
      geojson: { type: 'Polygon', coordinates: [] },
    });
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM "osm"."admin_boundaries"'),
      1,
    );
  });

  it('should fallback to public schema and geom column when not specified', async () => {
    const mockPrisma = {
      $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaClient;

    const useCase = new GetBoundaryUseCase(mockPrisma);
    const result = await useCase.execute('admin_boundaries', 99);

    expect(result).toBeNull();
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM "public"."admin_boundaries"'),
      99,
    );
  });
});
