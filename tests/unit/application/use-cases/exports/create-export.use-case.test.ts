import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateExportUseCase } from '../../../../../src/application/use-cases/exports/create-export.use-case.js';
import type { IExportRepository } from '../../../../../src/domain/repositories/export.repository.js';
import { Export } from '../../../../../src/domain/entities/export.entity.js';
import { ExportFormat, JobStatus } from '../../../../../src/domain/enums.js';

describe('CreateExportUseCase', () => {
  let useCase: CreateExportUseCase;
  let exportRepository: IExportRepository;
  const now = new Date();

  beforeEach(() => {
    exportRepository = {
      findById: vi.fn(),
      findByUser: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    };
    useCase = new CreateExportUseCase(exportRepository);
  });

  it('should create an export with PENDING status', async () => {
    const created = new Export({
      id: 'exp-1',
      format: ExportFormat.GEOJSON,
      status: JobStatus.PENDING,
      layerId: 'layer-1',
      userId: 'user-1',
      filePath: null,
      fileSize: null,
      bbox: [1, 2, 3, 4],
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    vi.mocked(exportRepository.create).mockResolvedValue(created);

    const result = await useCase.execute('user-1', {
      format: ExportFormat.GEOJSON,
      layerId: 'layer-1',
      bbox: [1, 2, 3, 4],
    });

    expect(result.status).toBe(JobStatus.PENDING);
    expect(result.format).toBe(ExportFormat.GEOJSON);
    expect(result.userId).toBe('user-1');
    expect(exportRepository.create).toHaveBeenCalledOnce();
  });

  it('should create export without bbox', async () => {
    const created = new Export({
      id: 'exp-2',
      format: ExportFormat.SHAPEFILE,
      status: JobStatus.PENDING,
      layerId: 'layer-1',
      userId: 'user-1',
      filePath: null,
      fileSize: null,
      bbox: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    vi.mocked(exportRepository.create).mockResolvedValue(created);

    const result = await useCase.execute('user-1', {
      format: ExportFormat.SHAPEFILE,
      layerId: 'layer-1',
    });

    expect(result.bbox).toBeNull();
    expect(result.format).toBe(ExportFormat.SHAPEFILE);
  });
});
