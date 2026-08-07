import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenerateAnalysisReportUseCase } from '../../../../../src/application/use-cases/reports/generate-analysis-report.use-case.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';
import type { QueueService } from '../../../../../src/infrastructure/queue/queue.service.js';
import type { PrismaClient } from '@prisma/client';

describe('GenerateAnalysisReportUseCase', () => {
  let queueService: QueueService;

  beforeEach(() => {
    queueService = { addJob: vi.fn().mockResolvedValue({ id: 'job-1' }) } as any;
  });

  it('should create a pending report and enqueue the job', async () => {
    const mockPrisma = {
      analysisReport: { create: vi.fn().mockResolvedValue({ id: 'report-1' }) },
    } as unknown as PrismaClient;

    const useCase = new GenerateAnalysisReportUseCase(mockPrisma, queueService);
    const result = await useCase.execute(
      'user-1',
      'inst-1',
      'Densité de population à Douala 3',
      ['layer-1', 'layer-2'],
      [9.6, 4.0, 9.8, 4.1],
    );

    expect(result).toEqual({ reportId: 'report-1' });
    expect(mockPrisma.analysisReport.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        instanceId: 'inst-1',
        topic: 'Densité de population à Douala 3',
        layerIds: ['layer-1', 'layer-2'],
        status: 'PENDING',
      },
    });
    expect(queueService.addJob).toHaveBeenCalledWith('analysis-report', 'generate', {
      reportId: 'report-1',
      userId: 'user-1',
      instanceId: 'inst-1',
      topic: 'Densité de population à Douala 3',
      layerIds: ['layer-1', 'layer-2'],
      extent: [9.6, 4.0, 9.8, 4.1],
    });
  });

  it('should throw ValidationError when topic is empty', async () => {
    const mockPrisma = { analysisReport: { create: vi.fn() } } as unknown as PrismaClient;
    const useCase = new GenerateAnalysisReportUseCase(mockPrisma, queueService);

    await expect(useCase.execute('user-1', 'inst-1', '  ', ['layer-1'])).rejects.toThrow(
      ValidationError,
    );
    expect(queueService.addJob).not.toHaveBeenCalled();
  });

  it('should throw ValidationError when no layers are provided', async () => {
    const mockPrisma = { analysisReport: { create: vi.fn() } } as unknown as PrismaClient;
    const useCase = new GenerateAnalysisReportUseCase(mockPrisma, queueService);

    await expect(useCase.execute('user-1', 'inst-1', 'Sujet', [])).rejects.toThrow(
      ValidationError,
    );
    expect(queueService.addJob).not.toHaveBeenCalled();
  });
});
