import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryJobUseCase } from '../../../../../src/application/use-cases/admin/retry-job.use-case.js';

describe('RetryJobUseCase', () => {
  let useCase: RetryJobUseCase;
  let queueService: { getQueueNames: ReturnType<typeof vi.fn>; getQueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueService = {
      getQueueNames: vi.fn().mockReturnValue(['default']),
      getQueue: vi.fn(),
    };
    useCase = new RetryJobUseCase(queueService as any);
  });

  it('should retry a failed job successfully', async () => {
    const mockJob = {
      getState: vi.fn().mockResolvedValue('failed'),
      retry: vi.fn().mockResolvedValue(undefined),
    };
    const mockQueue = { getJob: vi.fn().mockResolvedValue(mockJob) };
    queueService.getQueue.mockReturnValue(mockQueue);

    const result = await useCase.execute('job-1');
    expect(result.success).toBe(true);
    expect(mockJob.retry).toHaveBeenCalledWith('failed');
  });

  it('should return failure if job is not in failed state', async () => {
    const mockJob = {
      getState: vi.fn().mockResolvedValue('active'),
      retry: vi.fn(),
    };
    const mockQueue = { getJob: vi.fn().mockResolvedValue(mockJob) };
    queueService.getQueue.mockReturnValue(mockQueue);

    const result = await useCase.execute('job-1');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not in failed state');
  });

  it('should return failure if job not found', async () => {
    const mockQueue = { getJob: vi.fn().mockResolvedValue(null) };
    queueService.getQueue.mockReturnValue(mockQueue);

    const result = await useCase.execute('nonexistent');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
