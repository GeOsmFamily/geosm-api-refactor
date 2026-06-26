import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetJobDetailsUseCase } from '../../../../../src/application/use-cases/admin/get-job-details.use-case.js';

describe('GetJobDetailsUseCase', () => {
  let useCase: GetJobDetailsUseCase;
  let queueService: { getQueueNames: ReturnType<typeof vi.fn>; getQueue: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queueService = {
      getQueueNames: vi.fn().mockReturnValue(['default']),
      getQueue: vi.fn(),
    };
    useCase = new GetJobDetailsUseCase(queueService as any);
  });

  it('should return job details when found', async () => {
    const mockJob = {
      id: 'job-1',
      name: 'export',
      data: { format: 'csv' },
      progress: 50,
      attemptsMade: 1,
      failedReason: undefined,
      timestamp: 1700000000000,
      processedOn: 1700000001000,
      finishedOn: null,
      getState: vi.fn().mockResolvedValue('active'),
    };
    const mockQueue = { getJob: vi.fn().mockResolvedValue(mockJob) };
    queueService.getQueue.mockReturnValue(mockQueue);

    const result = await useCase.execute('job-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('job-1');
    expect(result!.status).toBe('active');
    expect(result!.queue).toBe('default');
  });

  it('should return null if job not found in any queue', async () => {
    const mockQueue = { getJob: vi.fn().mockResolvedValue(null) };
    queueService.getQueue.mockReturnValue(mockQueue);

    const result = await useCase.execute('nonexistent');
    expect(result).toBeNull();
  });

  it('should skip queues that return null', async () => {
    queueService.getQueueNames.mockReturnValue(['q1', 'q2']);
    queueService.getQueue.mockImplementation((name: string) => {
      if (name === 'q1') return null;
      return { getJob: vi.fn().mockResolvedValue(null) };
    });

    const result = await useCase.execute('job-1');
    expect(result).toBeNull();
  });
});
