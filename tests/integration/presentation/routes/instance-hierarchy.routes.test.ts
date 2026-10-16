import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { instanceRoutes } from '../../../../src/presentation/routes/instance.routes.js';
import { adminRoutes } from '../../../../src/presentation/routes/admin.routes.js';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';
import { Instance, type InstanceProps } from '../../../../src/domain/entities/instance.entity.js';
import { InstanceKind } from '../../../../src/domain/enums.js';
import type { IInstanceRepository } from '../../../../src/domain/repositories/instance.repository.js';
import { GetInstanceTreeUseCase } from '../../../../src/application/use-cases/instances/get-instance-tree.use-case.js';
import { GetInstanceChildrenUseCase } from '../../../../src/application/use-cases/instances/get-instance-children.use-case.js';
import { UpdateInstanceHierarchyUseCase } from '../../../../src/application/use-cases/instances/update-instance-hierarchy.use-case.js';

const AFRICA = '11111111-1111-4111-8111-111111111111';
const CAMEROON = '22222222-2222-4222-8222-222222222222';
const CHAD = '33333333-3333-4333-8333-333333333333';
const now = new Date();

function make(id: string, name: string, over: Partial<InstanceProps> = {}): Instance {
  return new Instance({
    id, name, slug: name.toLowerCase(), description: null, logo: null, bbox: null,
    centerLat: null, centerLon: null, defaultZoom: 6, boundaryTable: null, boundaryId: null,
    boundaryGeomCol: null, adminLevel: null, parentInstanceId: null, isActive: true,
    createdAt: now, updatedAt: now, ...over,
  });
}

function fakeRepo(): IInstanceRepository {
  const store = new Map<string, Instance>(
    [
      make(AFRICA, 'Afrique', { kind: InstanceKind.CONTINENT, continentCode: 'AF', isActive: false }),
      make(CAMEROON, '{"fr":"Cameroun","en":"Cameroon"}', {
        slug: 'cameroun',
        parentInstanceId: AFRICA,
        continentCode: 'AF',
      }),
      make(CHAD, 'Tchad', { parentInstanceId: AFRICA, continentCode: 'AF', isActive: false }),
    ].map((i) => [i.id, i]),
  );
  return {
    findById: async (id: string) => store.get(id) ?? null,
    findAllForTree: async () => [...store.values()],
    findChildren: async (p: string) => [...store.values()].filter((i) => i.parentInstanceId === p),
    update: async (id: string, data: Partial<InstanceProps>) => {
      const next = new Instance({ ...(store.get(id) as unknown as InstanceProps), ...data });
      store.set(id, next);
      return next;
    },
  } as unknown as IInstanceRepository;
}

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

  const repo = fakeRepo();
  const real: Record<string, unknown> = {
    getInstanceTreeUseCase: new GetInstanceTreeUseCase(repo),
    getInstanceChildrenUseCase: new GetInstanceChildrenUseCase(repo),
    updateInstanceHierarchyUseCase: new UpdateInstanceHierarchyUseCase(repo),
  };
  app.decorate('diContainer', {
    resolve: (name: string) => real[name] ?? { execute: vi.fn().mockResolvedValue({}) },
  });

  app.register(instanceRoutes, { prefix: '/instances' });
  app.register(adminRoutes, { prefix: '/admin' });
  return app;
}

describe('Territoire : routes', () => {
  let app: FastifyInstance;
  const token = (role: string) => app.jwt.sign({ sub: 'u1', email: 'a@b.c', role });

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  describe('GET /instances/tree', () => {
    it('est public, imbrique les pays et pose un Cache-Control', async () => {
      const res = await app.inject({ method: 'GET', url: '/instances/tree' });

      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({ slug: 'afrique', kind: 'CONTINENT', continentCode: 'AF' });
      expect(body.data[0].children.map((c: any) => c.slug)).toEqual(['cameroun', 'tchad']);
      expect(body.data[0].children[1].isActive).toBe(false);
    });

    // Constate en recette (16 oct) : le nom multilingue arrivait en JSON brut sur l'accueil.
    it('traduit les noms des pays imbriques selon Accept-Language', async () => {
      const fr = await app.inject({ method: 'GET', url: '/instances/tree' });
      const en = await app.inject({
        method: 'GET',
        url: '/instances/tree',
        headers: { 'accept-language': 'en-US,en;q=0.9' },
      });

      expect(fr.json().data[0].children[0].name).toBe('Cameroun');
      expect(en.json().data[0].children[0].name).toBe('Cameroon');
      expect(en.headers['vary']).toContain('Accept-Language');
    });
  });

  describe('GET /instances/:id/children', () => {
    it('est public et liste les pays du continent', async () => {
      const res = await app.inject({ method: 'GET', url: `/instances/${AFRICA}/children` });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.map((c: any) => c.id)).toEqual([CAMEROON, CHAD]);
    });

    it('retourne 404 pour une instance inconnue', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/instances/99999999-9999-4999-8999-999999999999/children',
      });
      expect(res.statusCode).toBe(404);
    });

    it('retourne 400 pour un identifiant invalide', async () => {
      const res = await app.inject({ method: 'GET', url: '/instances/not-a-uuid/children' });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('PATCH /admin/instances/:id', () => {
    const url = `/admin/instances/${CAMEROON}`;

    it('retourne 401 sans jeton', async () => {
      const res = await app.inject({ method: 'PATCH', url, payload: { flagIconUrl: 'https://f/cm.svg' } });
      expect(res.statusCode).toBe(401);
    });

    it('retourne 403 pour un ADMIN_INSTANCE', async () => {
      const res = await app.inject({
        method: 'PATCH', url,
        headers: { authorization: `Bearer ${token('ADMIN_INSTANCE')}` },
        payload: { flagIconUrl: 'https://f/cm.svg' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('retourne 400 pour un corps vide ou invalide', async () => {
      const auth = { authorization: `Bearer ${token('SUPER_ADMIN')}` };
      const empty = await app.inject({ method: 'PATCH', url, headers: auth, payload: {} });
      expect(empty.statusCode).toBe(400);
      const bad = await app.inject({ method: 'PATCH', url, headers: auth, payload: { kind: 'PLANET' } });
      expect(bad.statusCode).toBe(400);
      const code = await app.inject({ method: 'PATCH', url, headers: auth, payload: { continentCode: 'af' } });
      expect(code.statusCode).toBe(400);
    });

    it('retourne 422 INVALID_HIERARCHY pour un pays rattache a un autre pays', async () => {
      const res = await app.inject({
        method: 'PATCH', url,
        headers: { authorization: `Bearer ${token('SUPER_ADMIN')}` },
        payload: { parentInstanceId: CHAD },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('INVALID_HIERARCHY');
    });

    it('met a jour le drapeau pour un SUPER_ADMIN (200)', async () => {
      const res = await app.inject({
        method: 'PATCH', url,
        headers: { authorization: `Bearer ${token('SUPER_ADMIN')}` },
        payload: { parentInstanceId: AFRICA, flagIconUrl: 'https://flagcdn.com/cm.svg' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toMatchObject({
        parentInstanceId: AFRICA,
        flagIconUrl: 'https://flagcdn.com/cm.svg',
        continentCode: 'AF',
      });
    });
  });
});
