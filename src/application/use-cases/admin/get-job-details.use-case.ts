import { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('GetJobDetailsUseCase');

export interface JobDetails {
  id: string;
  name: string;
  queue: string;
  status: string;
  data: Record<string, unknown>;
  progress: number | object | string | boolean;
  attemptsMade: number;
  failedReason: string | undefined;
  createdAt: Date | undefined;
  processedAt: Date | undefined;
  finishedAt: Date | undefined;
}

export class GetJobDetailsUseCase {
  constructor(private readonly queueService: QueueService) {}

  async execute(jobId: string): Promise<JobDetails | null> {
    const queueNames = this.queueService.getQueueNames();

    for (const queueName of queueNames) {
      const queue = this.queueService.getQueue(queueName);
      if (!queue) continue;

      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        logger.debug('Job details retrieved', { jobId, queue: queueName, status: state });
        return {
          id: job.id ?? jobId,
          name: job.name,
          queue: queueName,
          status: state,
          data: job.data as Record<string, unknown>,
          progress: job.progress,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          createdAt: job.timestamp ? new Date(job.timestamp) : undefined,
          processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
          finishedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        };
      }
    }

    logger.debug('Job details lookup: not found', { jobId });
    return null;
  }
}
