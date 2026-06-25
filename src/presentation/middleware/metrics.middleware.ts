import type { FastifyInstance } from 'fastify';
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpRequestSizeBytes,
  httpResponseSizeBytes,
} from '../../infrastructure/observability/metrics.js';

export async function metricsMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();
    const duration = reply.elapsedTime / 1000;

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, duration);

    // Track request size
    const reqContentLength = request.headers['content-length'];
    if (reqContentLength) {
      httpRequestSizeBytes.observe({ method, route }, parseInt(reqContentLength, 10));
    }

    // Track response size
    const resContentLength = reply.getHeader('content-length');
    if (resContentLength) {
      httpResponseSizeBytes.observe({ method, route }, parseInt(String(resContentLength), 10));
    }
  });
}
