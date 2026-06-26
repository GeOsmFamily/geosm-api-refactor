import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { groupRoutes } from '../../../../src/presentation/routes/group.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';

const JWT_SECRET = 'test-secret-key-for-integration-tests';
const INSTANCE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const GROUP_UUID = '660e8400-e29b-41d4-a716-446655440000';
const GROUP_UUID_2 = '770e8400-e29b-41d4-a716-446655440000';

function mockUseCase(result: unknown = { id: GROUP_UUID }) {
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
    listGroupsUseCase: mockUseCase([]),
    getGroupUseCase: mockUseCase({ id: GROUP_UUID, name: 'Test Group' }),
    createGroupUseCase: mockUseCase({ id: GROUP_UUID, name: 'New Group' }),
    updateGroupUseCase: mockUseCase({ id: GROUP_UUID, name: 'Updated Group' }),
    deleteGroupUseCase: mockUseCase(null),
    reorderGroupsUseCase: mockUseCase(null),
  };

  app.decorate('diContainer', {
    resolve: (name: string) => useCases[name],
  });

  // Group routes are mounted under /instances/:instanceId/groups
  app.register(groupRoutes, { prefix: '/instances/:instanceId/groups' });
  return app;
}

function tokenFor(app: FastifyInstance, role: string): string {
  return app.jwt.sign({ sub: 'user-1', email: 'test@test.com', role });
}

describe('Group Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const base = `/instances/${INSTANCE_UUID}/groups`;

  // --- GET / ---
  describe('GET /', () => {
    it('should list groups when authenticated (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({ method: 'GET', url: base });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- GET /:id ---
  describe('GET /:id', () => {
    it('should get group by id (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${base}/${GROUP_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject non-uuid id (400)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${base}/not-a-uuid`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  // --- POST / ---
  describe('POST /', () => {
    const validPayload = { name: 'New Group', slug: 'new-group' };

    it('should create group as SUPER_ADMIN (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: validPayload,
      });
      expect(response.statusCode).toBe(201);
    });

    it('should create group as ADMIN_INSTANCE (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'ADMIN_INSTANCE')}` },
        payload: validPayload,
      });
      expect(response.statusCode).toBe(201);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: validPayload,
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject as EDITOR (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'EDITOR')}` },
        payload: validPayload,
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject missing name (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { slug: 'no-name' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject missing slug (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'No Slug' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        payload: validPayload,
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- PATCH /:id ---
  describe('PATCH /:id', () => {
    it('should update group as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/${GROUP_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'Updated Group' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/${GROUP_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: { name: 'Updated' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // --- DELETE /:id ---
  describe('DELETE /:id', () => {
    it('should delete group as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${GROUP_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as EDITOR (403)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${GROUP_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'EDITOR')}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${GROUP_UUID}`,
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- PATCH /reorder ---
  describe('PATCH /reorder', () => {
    it('should reorder groups as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/reorder`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { orders: [{ id: GROUP_UUID, order: 1 }, { id: GROUP_UUID_2, order: 2 }] },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid orders format (400)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/reorder`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { orders: [{ id: 'not-uuid', order: 'bad' }] },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/reorder`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: { orders: [{ id: GROUP_UUID, order: 1 }] },
      });
      expect(response.statusCode).toBe(403);
    });
  });
});
