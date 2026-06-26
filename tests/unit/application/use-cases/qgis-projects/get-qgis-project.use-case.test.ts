import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetQgisProjectUseCase } from '../../../../../src/application/use-cases/qgis-projects/get-qgis-project.use-case.js';

describe('GetQgisProjectUseCase', () => {
  let useCase: GetQgisProjectUseCase;
  let repository: { findByInstanceId: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findByInstanceId: vi.fn() };
    useCase = new GetQgisProjectUseCase(repository as any);
  });

  it('should return projects for an instance', async () => {
    const projects = [{ id: 'qp-1', name: 'Project 1' }];
    repository.findByInstanceId.mockResolvedValue(projects);

    const result = await useCase.execute('instance-1');
    expect(result).toEqual(projects);
    expect(repository.findByInstanceId).toHaveBeenCalledWith('instance-1');
  });

  it('should return empty array when no projects exist', async () => {
    repository.findByInstanceId.mockResolvedValue([]);
    const result = await useCase.execute('instance-1');
    expect(result).toEqual([]);
  });
});
