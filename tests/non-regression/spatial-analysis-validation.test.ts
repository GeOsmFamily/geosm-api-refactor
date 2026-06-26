import { describe, it, expect, vi } from 'vitest';
import { SpatialAnalysisUseCase } from '../../src/application/use-cases/analysis/spatial-analysis.use-case.js';
import { ValidationError } from '../../src/domain/errors/validation.error.js';

describe('SpatialAnalysisUseCase validation non-regression', () => {
  const prisma = {
    $queryRawUnsafe: vi.fn().mockResolvedValue([{ geometry: {} }]),
  };
  const useCase = new SpatialAnalysisUseCase(prisma as any);

  it('should reject geometry without type field', async () => {
    await expect(useCase.execute({
      operation: 'buffer',
      geometryA: { coordinates: [0, 0] },
      distance: 100,
    })).rejects.toThrow(ValidationError);
  });

  it('should reject geometry without coordinates field', async () => {
    await expect(useCase.execute({
      operation: 'buffer',
      geometryA: { type: 'Point' },
      distance: 100,
    })).rejects.toThrow(ValidationError);
  });

  it('should reject completely empty geometry object', async () => {
    await expect(useCase.execute({
      operation: 'buffer',
      geometryA: {},
      distance: 100,
    })).rejects.toThrow(ValidationError);
  });

  it('should accept valid GeoJSON geometry for buffer', async () => {
    await expect(useCase.execute({
      operation: 'buffer',
      geometryA: { type: 'Point', coordinates: [0, 0] },
      distance: 100,
    })).resolves.toBeDefined();
  });

  it('should require geometryB for intersection operation', async () => {
    await expect(useCase.execute({
      operation: 'intersection',
      geometryA: { type: 'Point', coordinates: [0, 0] },
    })).rejects.toThrow(ValidationError);
  });

  it('should require geometryB for union operation', async () => {
    await expect(useCase.execute({
      operation: 'union',
      geometryA: { type: 'Point', coordinates: [0, 0] },
    })).rejects.toThrow(ValidationError);
  });

  it('should require geometryB for difference operation', async () => {
    await expect(useCase.execute({
      operation: 'difference',
      geometryA: { type: 'Point', coordinates: [0, 0] },
    })).rejects.toThrow(ValidationError);
  });

  it('should reject invalid geometryB', async () => {
    await expect(useCase.execute({
      operation: 'intersection',
      geometryA: { type: 'Point', coordinates: [0, 0] },
      geometryB: { type: 'Polygon' }, // missing coordinates
    })).rejects.toThrow(ValidationError);
  });

  it('should accept valid geometryA and geometryB for intersection', async () => {
    await expect(useCase.execute({
      operation: 'intersection',
      geometryA: { type: 'Point', coordinates: [0, 0] },
      geometryB: { type: 'Point', coordinates: [1, 1] },
    })).resolves.toBeDefined();
  });

  it('should default srid to 4326 when not provided', async () => {
    await useCase.execute({
      operation: 'buffer',
      geometryA: { type: 'Point', coordinates: [0, 0] },
      distance: 50,
    });
    const sql = prisma.$queryRawUnsafe.mock.calls.at(-1)?.[0] as string;
    expect(sql).toContain('4326');
  });

  it('should use absolute value for buffer distance', async () => {
    await useCase.execute({
      operation: 'buffer',
      geometryA: { type: 'Point', coordinates: [0, 0] },
      distance: -200,
    });
    const sql = prisma.$queryRawUnsafe.mock.calls.at(-1)?.[0] as string;
    expect(sql).toContain('200');
    expect(sql).not.toContain('-200');
  });
});
