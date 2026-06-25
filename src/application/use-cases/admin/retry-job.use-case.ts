import { QueueService } from '../../../infrastructure/queue/queue.service.js';

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
          return { success: false, message: `Job is not in failed state (current: ${state})` };
        }
        await job.retry(state);
        return { success: true, message: `Job ${jobId} has been queued for retry` };
      }
    }

    return { success: false, message: `Job ${jobId} not found` };
  }
}
