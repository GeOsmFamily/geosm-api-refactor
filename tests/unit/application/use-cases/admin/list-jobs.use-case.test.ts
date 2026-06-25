import { describe, it, expect } from 'vitest';
import { ListJobsUseCase } from '../../../../../src/application/use-cases/admin/list-jobs.use-case.js';

describe('ListJobsUseCase', () => {
  it('should return empty array (placeholder)', async () => {
    const useCase = new ListJobsUseCase();
    const result = await useCase.execute();
    expect(result).toEqual([]);
  });
});
