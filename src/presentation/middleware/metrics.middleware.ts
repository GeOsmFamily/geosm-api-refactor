import type { FastifyInstance } from 'fastify';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../../infrastructure/observability/metrics.js';

export async function metricsMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();
    const duration = reply.elapsedTime / 1000;

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, duration);
  });
}
