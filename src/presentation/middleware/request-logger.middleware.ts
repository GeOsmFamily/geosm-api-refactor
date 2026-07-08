import type { FastifyInstance } from 'fastify';
import { logger } from '../../infrastructure/observability/logger.js';

const SENSITIVE_PARAMS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'api_key',
  'apiKey',
]);

function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    sanitized[key] = SENSITIVE_PARAMS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return sanitized;
}

export async function requestLoggerMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    logger.info('Incoming request', {
      method: request.method,
      url: request.url,
      requestId: request.id,
      correlationId: request.id,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      contentLength: request.headers['content-length'],
      query: request.query ? sanitizeQuery(request.query as Record<string, unknown>) : undefined,
      userId: (request as unknown as Record<string, unknown>).userId || undefined,
    });
  });

  app.addHook('onResponse', async (request, reply) => {
    const statusCode = reply.statusCode;
    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('Request completed', {
      method: request.method,
      url: request.url,
      statusCode,
      requestId: request.id,
      correlationId: request.id,
      responseTime: reply.elapsedTime,
      responseSize: reply.getHeader('content-length'),
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: (request as unknown as Record<string, unknown>).userId || undefined,
    });
  });

  app.addHook('onError', async (request, _reply, error) => {
    logger.error('Request error', {
      method: request.method,
      url: request.url,
      requestId: request.id,
      correlationId: request.id,
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      userId: (request as unknown as Record<string, unknown>).userId || undefined,
    });
  });
}
