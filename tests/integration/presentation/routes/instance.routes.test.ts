import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { instanceRoutes } from '../../../../src/presentation/routes/instance.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';

const JWT_SECRET = 'test-secret-key-for-integration-tests';
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440000';

function mockUseCase(result: unknown = { id: VALID_UUID }) {
  return { execute: vi.fn().mockResolvedValue(result) };
}

function buildApp(): FastifyInstance {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  app.register(fastifyJwt, { secret: JWT_SECRET });

  app.decorate('authenticate', async function (request: any, _reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });

  const useCases: Record<string, any> = {
    listInstancesUseCase: mockUseCase({ data: [], total: 0 }),
    getInstanceUseCase: mockUseCase({ id: VALID_UUID, name: 'Test' }),
    createInstanceUseCase: mockUseCase({ id: VALID_UUID, name: 'New Instance' }),
    updateInstanceUseCase: mockUseCase({ id: VALID_UUID, name: 'Updated' }),
    deleteInstanceUseCase: mockUseCase(null),
    getInstanceUsersUseCase: mockUseCase([]),
    addInstanceUserUseCase: mockUseCase({ id: 'rel-1' }),
    removeInstanceUserUseCase: mockUseCase(null),
    changeInstanceUserRoleUseCase: mockUseCase({ id: 'rel-1' }),
  };

  app.decorate('diContainer', {
    resolve: (name: string) => useCases[name],
  });

  app.register(instanceRoutes);
  return app;
}

function tokenFor(app: FastifyInstance, role: string): string {
  return app.jwt.sign({ sub: 'user-1', email: 'test@test.com', role });
}

describe('Instance Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // --- GET / ---
  describe('GET /', () => {
    it('should list instances when authenticated (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    // Public depuis le 2026-07-07 (comme GET /slug/:slug et le catalogue) : un visiteur
    // anonyme doit pouvoir découvrir les instances pour consulter le géoportail sans compte -
    // voir project_geosm_auth_flow_fixes. Aucune donnée sensible exposée.
    it('should allow unauthenticated request (200, public route)', async () => {
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
    });
  });

  // --- GET /:id ---
  describe('GET /:id', () => {
    it('should get instance by id (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/${VALID_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject non-uuid id (400)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/not-a-uuid',
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({ method: 'GET', url: `/${VALID_UUID}` });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- POST / ---
  describe('POST /', () => {
    it('should create instance as SUPER_ADMIN (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'New Instance', slug: 'new-instance' },
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: { name: 'New Instance', slug: 'new-instance' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject missing name (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { slug: 'no-name' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/',
        payload: { name: 'Test', slug: 'test' },
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- PATCH /:id ---
  describe('PATCH /:id', () => {
    it('should update instance as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/${VALID_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'Updated' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/${VALID_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: { name: 'Updated' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // --- DELETE /:id ---
  describe('DELETE /:id', () => {
    it('should delete instance as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/${VALID_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as EDITOR (403)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/${VALID_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'EDITOR')}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({ method: 'DELETE', url: `/${VALID_UUID}` });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- Instance users ---
  describe('GET /:instanceId/users', () => {
    it('should list users as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/${VALID_UUID}/users`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/${VALID_UUID}/users`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /:instanceId/users', () => {
    it('should add user as SUPER_ADMIN (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/${VALID_UUID}/users`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { userId: VALID_UUID_2 },
      });
      expect(response.statusCode).toBe(201);
    });
  });
});
