import { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('RetryJobUseCase');

export class RetryJobUseCase {
  constructor(private readonly queueService: QueueService) {}

  async execute(jobId: string): Promise<{ success: boolean; message: string }> {
    const queueNames = this.queueService.getQueueNames();

    for (const queueName of queueNames) {
      const queue = this.queueService.getQueue(queueName);
      if (!queue) continue;

      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state !== 'failed') {
          logger.warn('Retry rejected: job is not in failed state', {
            jobId,
            queue: queueName,
            currentState: state,
          });
          return { success: false, message: `Job is not in failed state (current: ${state})` };
        }
        await job.retry(state);
        logger.info('Job retried', { jobId, queue: queueName });
        return { success: true, message: `Job ${jobId} has been queued for retry` };
      }
    }

    logger.warn('Retry rejected: job not found', { jobId });
    return { success: false, message: `Job ${jobId} not found` };
  }
}
