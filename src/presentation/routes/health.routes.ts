import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { metricsRegister } from '../../infrastructure/observability/metrics.js';
import { successResponse } from '../schemas/common.schema.js';

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

  app.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(successResponse({ status: 'ready' }));
  });

  app.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(successResponse({ status: 'live' }));
  });

  app.get('/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await metricsRegister.metrics();
    return reply.type(metricsRegister.contentType).send(metrics);
  });
}
