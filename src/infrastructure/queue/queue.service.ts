import { Queue, Worker, Job } from 'bullmq';
import { config } from '../../config/env.config.js';
import { logger } from '../observability/logger.js';
import { jobsProcessedTotal, jobsProcessingDurationSeconds, jobsWaitingCount, jobsFailedTotal } from '../observability/metrics.js';

export interface JobData {
  [key: string]: unknown;
}

export interface QueueConfig {
  name: string;
  concurrency?: number;
}

const connection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
};

export class QueueService {
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();

  createQueue(name: string): Queue {
    if (this.queues.has(name)) return this.queues.get(name)!;
    const queue = new Queue(name, { connection });
    this.queues.set(name, queue);
    return queue;
  }

  getQueue(name: string): Queue | undefined {
    return this.queues.get(name);
  }

  async addJob(queueName: string, jobName: string, data: JobData, opts?: { priority?: number; delay?: number; attempts?: number }): Promise<Job> {
    const queue = this.createQueue(queueName);
    return queue.add(jobName, data, {
      attempts: opts?.attempts ?? 3,
      backoff: { type: 'exponential', delay: 5000 },
      priority: opts?.priority,
      delay: opts?.delay,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    });
  }

  registerWorker(queueName: string, processor: (job: Job) => Promise<unknown>, concurrency = 1): Worker {
    if (this.workers.has(queueName)) return this.workers.get(queueName)!;
    const worker = new Worker(queueName, processor, { connection, concurrency });

    worker.on('completed', (job) => {
      jobsProcessedTotal.inc({ queue: queueName, status: 'completed' });
      if (job.processedOn && job.finishedOn) {
        jobsProcessingDurationSeconds.observe({ queue: queueName }, (job.finishedOn - job.processedOn) / 1000);
      }
      logger.info(`Job completed: ${job.id} in queue ${queueName}`);
    });

    worker.on('failed', (job, err) => {
      jobsProcessedTotal.inc({ queue: queueName, status: 'failed' });
      jobsFailedTotal.inc({ queue: queueName });
      logger.error(`Job failed: ${job?.id} in queue ${queueName}`, { error: err.message });
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  async getJobCounts(queueName: string): Promise<Record<string, number>> {
    const queue = this.getQueue(queueName);
    if (!queue) return {};
    const counts = await queue.getJobCounts('active', 'completed', 'failed', 'delayed', 'waiting');
    jobsWaitingCount.set({ queue: queueName }, counts.waiting ?? 0);
    return counts;
  }

  async close(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }
}
