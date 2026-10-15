import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { notificationRoutes } from '../../../../src/presentation/routes/notification.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';

const execute = vi.fn().mockResolvedValue({ notifications: 5, messages: 0 });

function buildApp(): FastifyInstance {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.register(fastifyJwt, { secret: 'test-secret-key-for-integration-tests' });
  app.decorate('authenticate', async function (request: any) {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });
  const useCases: Record<string, unknown> = { getUnreadCountersUseCase: { execute } };
  app.decorate('diContainer', {
    resolve: (name: string) => useCases[name] ?? { execute: vi.fn().mockResolvedValue({}) },
  });
  app.register(notificationRoutes, { prefix: '/notifications' });
  return app;
}

describe('GET /notifications/counters', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('retourne 401 sans jeton', async () => {
    const res = await app.inject({ method: 'GET', url: '/notifications/counters' });
    expect(res.statusCode).toBe(401);
  });

  it('retourne les compteurs de l\'utilisateur connecte', async () => {
    const token = app.jwt.sign({ sub: 'user-42', email: 'a@b.c', role: 'VIEWER' });
    const res = await app.inject({
      method: 'GET',
      url: '/notifications/counters',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, data: { notifications: 5, messages: 0 } });
    expect(execute).toHaveBeenCalledWith('user-42');
  });
});
