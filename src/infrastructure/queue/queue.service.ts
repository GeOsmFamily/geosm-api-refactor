import { Queue, Worker, Job } from 'bullmq';
import { trace } from '@opentelemetry/api';
import { config } from '../../config/env.config.js';
import { logger } from '../observability/logger.js';
import {
  jobsProcessedTotal,
  jobsProcessingDurationSeconds,
  jobsWaitingCount,
  jobsFailedTotal,
} from '../observability/metrics.js';

const tracer = trace.getTracer('geosm-bullmq');

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

  async addJob(
    queueName: string,
    jobName: string,
    data: JobData,
    opts?: { priority?: number; delay?: number; attempts?: number },
  ): Promise<Job> {
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

  /**
   * Programme un job récurrent (cron) via le support natif "repeat" de BullMQ - aucun
   * mécanisme de ce type n'existait avant (uniquement des jobs "one-shot" via addJob).
   * Idempotent : un job du même nom avec le même pattern n'est pas dupliqué par BullMQ,
   * donc rappeler cette méthode à chaque démarrage du serveur est sans danger.
   */
  async addRepeatableJob(
    queueName: string,
    jobName: string,
    data: JobData,
    cronPattern: string,
  ): Promise<Job> {
    const queue = this.createQueue(queueName);
    return queue.add(jobName, data, { repeat: { pattern: cronPattern } });
  }

  async getRepeatableJobs(queueName: string) {
    const queue = this.getQueue(queueName);
    if (!queue) return [];
    return queue.getRepeatableJobs();
  }

  registerWorker(
    queueName: string,
    processor: (job: Job) => Promise<unknown>,
    concurrency = 1,
  ): Worker {
    if (this.workers.has(queueName)) return this.workers.get(queueName)!;
    // Span manuel autour de l'exécution du job - aucune auto-instrumentation OTel ne couvre
    // BullMQ, sans quoi un job long (import OSM, backup...) resterait invisible en tracing.
    const tracedProcessor = (job: Job): Promise<unknown> =>
      tracer.startActiveSpan(`bullmq.${queueName}.${job.name}`, async (span) => {
        span.setAttribute('bullmq.job_id', job.id ?? 'unknown');
        try {
          return await processor(job);
        } catch (error) {
          span.recordException(error instanceof Error ? error : String(error));
          throw error;
        } finally {
          span.end();
        }
      });
    const worker = new Worker(queueName, tracedProcessor, { connection, concurrency });

    worker.on('completed', (job) => {
      jobsProcessedTotal.inc({ queue: queueName, status: 'completed' });
      if (job.processedOn && job.finishedOn) {
        jobsProcessingDurationSeconds.observe(
          { queue: queueName },
          (job.finishedOn - job.processedOn) / 1000,
        );
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
