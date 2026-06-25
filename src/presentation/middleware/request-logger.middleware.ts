import type { FastifyInstance } from 'fastify';
import { logger } from '../../infrastructure/observability/logger.js';

export async function requestLoggerMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    logger.info('Incoming request', {
      method: request.method,
      url: request.url,
      requestId: request.id,
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestId: request.id,
      responseTime: reply.elapsedTime,
    });
  });
}
