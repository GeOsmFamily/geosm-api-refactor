import { QueueService } from '../../../infrastructure/queue/queue.service.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';

const logger = createChildLogger('ListJobsUseCase');

export interface JobInfo {
  id: string;
  type: string;
  status: string;
  createdAt: Date;
}

export interface JobListResult {
  queues: {
    name: string;
    counts: Record<string, number>;
    recentJobs: JobInfo[];
  }[];
}

export class ListJobsUseCase {
  constructor(private readonly queueService: QueueService) {}

  async execute(): Promise<JobListResult> {
    const queueNames = this.queueService.getQueueNames();
    const queues: JobListResult['queues'] = [];

    for (const name of queueNames) {
      const queue = this.queueService.getQueue(name);
      if (!queue) continue;

      const counts = await queue.getJobCounts(
        'active',
        'completed',
        'failed',
        'delayed',
        'waiting',
      );

      // Get recent jobs (last 20)
      const jobs = await queue.getJobs(
        ['active', 'completed', 'failed', 'waiting', 'delayed'],
        0,
        19,
      );
      const recentJobs: JobInfo[] = jobs.map((job) => ({
        id: job.id ?? '',
        type: job.name,
        status: '', // will be filled below
        createdAt: job.timestamp ? new Date(job.timestamp) : new Date(),
      }));

      // Fill in status
      for (const jobInfo of recentJobs) {
        const job = await queue.getJob(jobInfo.id);
        if (job) {
          jobInfo.status = await job.getState();
        }
      }

      queues.push({ name, counts, recentJobs });
    }

    logger.debug('Job queues listed', { queueCount: queues.length });
    return { queues };
  }
}
