import { describe, it, expect } from 'vitest';
import { ListJobsUseCase } from '../../../../../src/application/use-cases/admin/list-jobs.use-case.js';

describe('ListJobsUseCase', () => {
  it('should return empty queues when no queues registered', async () => {
    const mockQueueService = {
      getQueueNames: () => [] as string[],
      getQueue: () => null,
    } as Parameters<typeof ListJobsUseCase.prototype.execute extends () => infer R ? never : never> & { getQueueNames: () => string[]; getQueue: () => null };

    const useCase = new ListJobsUseCase(mockQueueService as never);
    const result = await useCase.execute();
    expect(result).toEqual({ queues: [] });
  });
});
