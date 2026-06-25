import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { metricsRegister } from '../../infrastructure/observability/metrics.js';
import { successResponse } from '../schemas/common.schema.js';
import { logger } from '../../infrastructure/observability/logger.js';
import os from 'os';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}

async function checkPostgres(app: FastifyInstance): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const prisma = (app.diContainer?.resolve('prisma') as { $queryRawUnsafe: (sql: string) => Promise<unknown> } | undefined);
    if (prisma) {
      await prisma.$queryRawUnsafe('SELECT 1');
    }
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', responseTime: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis(app: FastifyInstance): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const redisService = app.diContainer?.resolve('redisService') as { getClient: () => { ping: () => Promise<string> } } | undefined;
    if (redisService) {
      await redisService.getClient().ping();
    }
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', responseTime: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkMinio(app: FastifyInstance): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const storageService = app.diContainer?.resolve('storageService') as { bucketExists?: () => Promise<boolean> } | undefined;
    if (storageService?.bucketExists) {
      await storageService.bucketExists();
    }
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', responseTime: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkMeiliSearch(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const host = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
    const response = await fetch(`${host}/health`);
    if (response.ok) {
      return { status: 'healthy', responseTime: Date.now() - start };
    }
    return { status: 'unhealthy', responseTime: Date.now() - start, error: `Status ${response.status}` };
  } catch (err) {
    return { status: 'unhealthy', responseTime: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkQGISServer(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const url = process.env.QGIS_SERVER_URL || 'http://localhost:8380/ows';
    const baseUrl = url.replace(/\/ows$/, '');
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
    return { status: response.ok || response.status < 500 ? 'healthy' : 'unhealthy', responseTime: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', responseTime: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

function getDiskUsage(): { usagePercent: number; free: string; total: string } {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const output = execSync("df -h / | tail -1").toString().trim();
    const parts = output.split(/\s+/);
    return {
      usagePercent: parseInt(parts[4]?.replace('%', '') || '0', 10),
      free: parts[3] || 'unknown',
      total: parts[1] || 'unknown',
    };
  } catch {
    return { usagePercent: 0, free: 'unknown', total: 'unknown' };
  }
}

function getMemoryUsage(): { usagePercent: number; totalMB: number; freeMB: number; heapUsedMB: number } {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const heapUsed = process.memoryUsage().heapUsed;
  return {
    usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    totalMB: Math.round(totalMem / 1024 / 1024),
    freeMB: Math.round(freeMem / 1024 / 1024),
    heapUsedMB: Math.round(heapUsed / 1024 / 1024),
  };
}

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(
      successResponse({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
    );
  });

  app.get('/health/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    const checks: Record<string, HealthCheckResult | Record<string, unknown>> = {};

    const [postgres, redis, minio, meilisearch, qgis] = await Promise.allSettled([
      checkPostgres(app),
      checkRedis(app),
      checkMinio(app),
      checkMeiliSearch(),
      checkQGISServer(),
    ]);

    checks.postgresql = postgres.status === 'fulfilled' ? postgres.value : { status: 'unhealthy', error: 'Check failed' };
    checks.redis = redis.status === 'fulfilled' ? redis.value : { status: 'unhealthy', error: 'Check failed' };
    checks.minio = minio.status === 'fulfilled' ? minio.value : { status: 'unhealthy', error: 'Check failed' };
    checks.meilisearch = meilisearch.status === 'fulfilled' ? meilisearch.value : { status: 'unhealthy', error: 'Check failed' };
    checks.qgisServer = qgis.status === 'fulfilled' ? qgis.value : { status: 'unhealthy', error: 'Check failed' };
    checks.disk = getDiskUsage();
    checks.memory = getMemoryUsage();

    // BullMQ queue status
    try {
      const queueService = app.diContainer?.resolve('queueService') as { getQueueNames: () => string[]; getJobCounts: (name: string) => Promise<Record<string, number>> } | undefined;
      if (queueService) {
        const queues: Record<string, Record<string, number>> = {};
        for (const name of queueService.getQueueNames()) {
          queues[name] = await queueService.getJobCounts(name);
        }
        checks.queues = queues;
      }
    } catch {
      checks.queues = { status: 'unhealthy', error: 'Failed to check queues' };
    }

    const allHealthy = [postgres, redis, minio, meilisearch].every(
      (r) => r.status === 'fulfilled' && r.value.status === 'healthy',
    );

    return reply.status(allHealthy ? 200 : 503).send(
      successResponse({
        status: allHealthy ? 'healthy' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        checks,
      }),
    );
  });

  app.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const [postgres, redis] = await Promise.all([
        checkPostgres(app),
        checkRedis(app),
      ]);

      const ready = postgres.status === 'healthy' && redis.status === 'healthy';
      return reply.status(ready ? 200 : 503).send(
        successResponse({ status: ready ? 'ready' : 'not_ready', checks: { postgres, redis } }),
      );
    } catch {
      return reply.status(503).send(successResponse({ status: 'not_ready' }));
    }
  });

  app.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(successResponse({ status: 'live', pid: process.pid, uptime: process.uptime() }));
  });

  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await metricsRegister.metrics();
    return reply.type(metricsRegister.contentType).send(metrics);
  });
}
