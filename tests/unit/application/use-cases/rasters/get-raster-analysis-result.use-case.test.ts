import { describe, it, expect, vi } from 'vitest';
import { GetRasterAnalysisResultUseCase } from '../../../../../src/application/use-cases/rasters/get-raster-analysis-result.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { PrismaClient } from '@prisma/client';

describe('GetRasterAnalysisResultUseCase', () => {
  it('should return the mapped result when found', async () => {
    const mockPrisma = {
      rasterAnalysisResult: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'result-1',
          layerId: 'layer-1',
          type: 'global',
          status: 'COMPLETED',
          result: { min: 0, max: 387, mean: 7.4, stddev: 22.3, count: 4080794 },
          error: null,
        }),
      },
    } as unknown as PrismaClient;

    const useCase = new GetRasterAnalysisResultUseCase(mockPrisma);
    const result = await useCase.execute('result-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.result).toEqual({ min: 0, max: 387, mean: 7.4, stddev: 22.3, count: 4080794 });
  });

  it('should throw NotFoundError when the result does not exist', async () => {
    const mockPrisma = {
      rasterAnalysisResult: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const useCase = new GetRasterAnalysisResultUseCase(mockPrisma);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
