import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReloadQgisProjectUseCase } from '../../../../../src/application/use-cases/qgis-projects/reload-qgis-project.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';

describe('ReloadQgisProjectUseCase', () => {
  let useCase: ReloadQgisProjectUseCase;
  let repository: { findByInstanceId: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByInstanceId: vi.fn(), update: vi.fn() };
    useCase = new ReloadQgisProjectUseCase(repository as any);
  });

  it('should reload all projects for an instance', async () => {
    const projects = [{ id: 'p1' }, { id: 'p2' }];
    repository.findByInstanceId.mockResolvedValue(projects);
    repository.update.mockImplementation((id: string) => Promise.resolve({ id, reloaded: true }));

    const result = await useCase.execute('inst-1');

    expect(result).toHaveLength(2);
    expect(repository.update).toHaveBeenCalledTimes(2);
    expect(repository.update).toHaveBeenCalledWith('p1', {});
    expect(repository.update).toHaveBeenCalledWith('p2', {});
  });

  it('should throw NotFoundError if no projects found', async () => {
    repository.findByInstanceId.mockResolvedValue([]);
    await expect(useCase.execute('inst-1')).rejects.toThrow(NotFoundError);
  });
});
