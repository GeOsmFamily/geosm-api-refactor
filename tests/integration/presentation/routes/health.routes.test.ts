import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { healthRoutes } from '../../../../src/presentation/routes/health.routes.js';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(healthRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health should return ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('GET /health/ready should return ready', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.data.status).toBe('ready');
  });

  it('GET /health/live should return live', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    const body = JSON.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.data.status).toBe('live');
  });

  it('GET /metrics should return prometheus metrics', async () => {
    const response = await app.inject({ method: 'GET', url: '/metrics' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
  });
});
