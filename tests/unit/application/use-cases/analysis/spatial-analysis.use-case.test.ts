import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpatialAnalysisUseCase } from '../../../../../src/application/use-cases/analysis/spatial-analysis.use-case.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('SpatialAnalysisUseCase', () => {
  let useCase: SpatialAnalysisUseCase;
  let prisma: { $queryRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    prisma = { $queryRawUnsafe: vi.fn() };
    useCase = new SpatialAnalysisUseCase(prisma as any);
  });

  it('should perform buffer operation', async () => {
    const geom = { type: 'Point', coordinates: [0, 0] };
    prisma.$queryRawUnsafe.mockResolvedValue([{ geometry: { type: 'Polygon', coordinates: [] } }]);

    const result = await useCase.execute({
      operation: 'buffer',
      geometryA: geom,
      distance: 500,
    });

    expect(result.type).toBe('buffer');
    expect(result.geometry).toBeDefined();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('ST_Buffer'));
  });

  it('should perform intersection operation', async () => {
    const geomA = { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,0]]] };
    const geomB = { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,0]]] };
    prisma.$queryRawUnsafe.mockResolvedValue([{ geometry: { type: 'Polygon' } }]);

    const result = await useCase.execute({
      operation: 'intersection',
      geometryA: geomA,
      geometryB: geomB,
    });

    expect(result.type).toBe('intersection');
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('ST_Intersection'));
  });

  it('should throw ValidationError for invalid geometry', async () => {
    await expect(
      useCase.execute({ operation: 'buffer', geometryA: { bad: true } as any }),
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError when geometryB missing for intersection', async () => {
    const geomA = { type: 'Point', coordinates: [0, 0] };
    await expect(
      useCase.execute({ operation: 'intersection', geometryA: geomA }),
    ).rejects.toThrow(ValidationError);
  });

  it('should return null geometry when query returns empty', async () => {
    const geom = { type: 'Point', coordinates: [0, 0] };
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await useCase.execute({ operation: 'buffer', geometryA: geom, distance: 100 });
    expect(result.geometry).toBeNull();
  });
});
