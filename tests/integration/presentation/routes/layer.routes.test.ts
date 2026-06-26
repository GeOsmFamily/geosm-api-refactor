import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { layerRoutes } from '../../../../src/presentation/routes/layer.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';

const JWT_SECRET = 'test-secret-key-for-integration-tests';
const INSTANCE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const LAYER_UUID = '660e8400-e29b-41d4-a716-446655440000';
const SUBGROUP_UUID = '770e8400-e29b-41d4-a716-446655440000';

function mockUseCase(result: unknown = { id: LAYER_UUID }) {
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
    listLayersUseCase: mockUseCase({ data: [], total: 0 }),
    getLayerUseCase: mockUseCase({ id: LAYER_UUID, name: 'Test Layer' }),
    createLayerUseCase: mockUseCase({ id: LAYER_UUID, name: 'New Layer' }),
    updateLayerUseCase: mockUseCase({ id: LAYER_UUID, name: 'Updated Layer' }),
    deleteLayerUseCase: mockUseCase(null),
    getSourceFileUseCase: mockUseCase({ url: 'https://example.com/file.geojson' }),
  };

  app.decorate('diContainer', {
    resolve: (name: string) => useCases[name],
  });

  // Layer routes are typically mounted under /instances/:instanceId/layers
  // But the route file itself uses relative paths, so we simulate the param prefix
  app.register(layerRoutes, { prefix: '/instances/:instanceId/layers' });
  return app;
}

function tokenFor(app: FastifyInstance, role: string): string {
  return app.jwt.sign({ sub: 'user-1', email: 'test@test.com', role });
}

describe('Layer Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const base = `/instances/${INSTANCE_UUID}/layers`;

  // --- GET / ---
  describe('GET /', () => {
    it('should list layers when authenticated (200)', async () => {
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
    it('should get layer by id (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${base}/${LAYER_UUID}`,
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
    const validPayload = {
      name: 'New Layer',
      slug: 'new-layer',
      geometryType: 'POINT',
      sourceType: 'WMS',
      subGroupId: SUBGROUP_UUID,
    };

    it('should create layer as EDITOR (201)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'EDITOR')}` },
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

    it('should reject missing required fields (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'Incomplete' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('should reject invalid geometryType (400)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: base,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { ...validPayload, geometryType: 'INVALID' },
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
    it('should update layer as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/${LAYER_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
        payload: { name: 'Updated Layer' },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `${base}/${LAYER_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
        payload: { name: 'Updated' },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  // --- DELETE /:id ---
  describe('DELETE /:id', () => {
    it('should delete layer as SUPER_ADMIN (200)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${LAYER_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'SUPER_ADMIN')}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('should reject as VIEWER (403)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${LAYER_UUID}`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('should reject unauthenticated (401)', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `${base}/${LAYER_UUID}`,
      });
      expect(response.statusCode).toBe(401);
    });
  });

  // --- GET /:id/source-file ---
  describe('GET /:id/source-file', () => {
    it('should get source file when authenticated (200)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${base}/${LAYER_UUID}/source-file`,
        headers: { authorization: `Bearer ${tokenFor(app, 'VIEWER')}` },
      });
      expect(response.statusCode).toBe(200);
    });
  });
});
