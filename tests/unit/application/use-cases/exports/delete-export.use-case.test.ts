import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteExportUseCase } from '../../../../../src/application/use-cases/exports/delete-export.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import type { IExportRepository } from '../../../../../src/domain/repositories/export.repository.js';
import { Export } from '../../../../../src/domain/entities/export.entity.js';
import { ExportFormat, JobStatus } from '../../../../../src/domain/enums.js';

describe('DeleteExportUseCase', () => {
  let useCase: DeleteExportUseCase;
  let exportRepository: IExportRepository;
  const now = new Date();
  const mockExport = new Export({
    id: 'e1', format: ExportFormat.GEOJSON, status: JobStatus.COMPLETED,
    layerId: 'l1', userId: 'u1', filePath: null, fileSize: null,
    bbox: null, errorMessage: null, startedAt: null, completedAt: null,
    createdAt: now, updatedAt: now,
  });

  beforeEach(() => {
    exportRepository = { findById: vi.fn(), findByUser: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() };
    useCase = new DeleteExportUseCase(exportRepository);
  });

  it('should delete export when found', async () => {
    vi.mocked(exportRepository.findById).mockResolvedValue(mockExport);
    await useCase.execute('e1');
    expect(exportRepository.delete).toHaveBeenCalledWith('e1');
  });

  it('should throw NotFoundError when not found', async () => {
    vi.mocked(exportRepository.findById).mockResolvedValue(null);
    await expect(useCase.execute('e1')).rejects.toThrow(NotFoundError);
  });
});
