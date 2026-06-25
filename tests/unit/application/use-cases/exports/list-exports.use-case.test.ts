import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListExportsUseCase } from '../../../../../src/application/use-cases/exports/list-exports.use-case.js';
import type { IExportRepository } from '../../../../../src/domain/repositories/export.repository.js';

describe('ListExportsUseCase', () => {
  let useCase: ListExportsUseCase;
  let exportRepository: IExportRepository;

  beforeEach(() => {
    exportRepository = { findById: vi.fn(), findByUser: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() };
    useCase = new ListExportsUseCase(exportRepository);
  });

  it('should return exports for user', async () => {
    vi.mocked(exportRepository.findByUser).mockResolvedValue({ data: [], total: 0 });
    const result = await useCase.execute('u1');
    expect(result).toEqual({ data: [], total: 0 });
    expect(exportRepository.findByUser).toHaveBeenCalledWith('u1', undefined);
  });

  it('should pass options', async () => {
    vi.mocked(exportRepository.findByUser).mockResolvedValue({ data: [], total: 0 });
    await useCase.execute('u1', { page: 2, limit: 5 });
    expect(exportRepository.findByUser).toHaveBeenCalledWith('u1', { page: 2, limit: 5 });
  });
});
