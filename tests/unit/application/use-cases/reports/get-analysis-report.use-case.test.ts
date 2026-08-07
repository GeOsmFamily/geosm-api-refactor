import { describe, it, expect, vi } from 'vitest';
import { GetAnalysisReportUseCase } from '../../../../../src/application/use-cases/reports/get-analysis-report.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { PrismaClient } from '@prisma/client';

describe('GetAnalysisReportUseCase', () => {
  it('should return the mapped report when found', async () => {
    const mockPrisma = {
      analysisReport: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'report-1',
          topic: 'Densité de population à Douala 3',
          layerIds: ['layer-1'],
          status: 'COMPLETED',
          resultJson: [{ layerId: 'layer-1', name: 'Population', kind: 'raster' }],
          filePath: 'analysis-reports/report-1/report.pdf',
          fileSize: 12345,
          errorMessage: null,
        }),
      },
    } as unknown as PrismaClient;

    const useCase = new GetAnalysisReportUseCase(mockPrisma);
    const result = await useCase.execute('report-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.filePath).toBe('analysis-reports/report-1/report.pdf');
    expect(result.fileSize).toBe(12345);
  });

  it('should throw NotFoundError when the report does not exist', async () => {
    const mockPrisma = {
      analysisReport: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const useCase = new GetAnalysisReportUseCase(mockPrisma);
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
