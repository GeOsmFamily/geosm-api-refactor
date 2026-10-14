import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import {
  legacyLayerGroupRedirects,
  rewriteLegacyLayerGroupPath,
} from '../../../../src/presentation/routes/legacy-layer-group-redirects.js';

const API = '/api/v1';
const INSTANCE = '550e8400-e29b-41d4-a716-446655440000';
const GROUP = '660e8400-e29b-41d4-a716-446655440000';

describe('rewriteLegacyLayerGroupPath', () => {
  it('reecrit le chemin des groupes du catalogue', () => {
    expect(rewriteLegacyLayerGroupPath(`${API}/instances/${INSTANCE}/groups`, API)).toBe(
      `${API}/instances/${INSTANCE}/layer-groups`,
    );
    expect(rewriteLegacyLayerGroupPath(`${API}/instances/${INSTANCE}/groups/${GROUP}`, API)).toBe(
      `${API}/instances/${INSTANCE}/layer-groups/${GROUP}`,
    );
  });

  it('reecrit le chemin des sous-groupes et conserve la query string', () => {
    expect(
      rewriteLegacyLayerGroupPath(`${API}/groups/${GROUP}/sub-groups?includeLayers=true`, API),
    ).toBe(`${API}/layer-groups/${GROUP}/layer-sub-groups?includeLayers=true`);
  });

  it('ne touche pas aux autres routes', () => {
    expect(rewriteLegacyLayerGroupPath(`${API}/instances/${INSTANCE}/layers`, API)).toBeNull();
    expect(rewriteLegacyLayerGroupPath(`${API}/instances/${INSTANCE}/groupsfoo`, API)).toBeNull();
    expect(rewriteLegacyLayerGroupPath(`/other/instances/${INSTANCE}/groups`, API)).toBeNull();
  });
});

describe('legacy layer-group redirects (308)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(legacyLayerGroupRedirects, { apiPrefix: API });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['GET', 'POST', 'PATCH', 'DELETE'] as const)(
    'redirige %s /instances/:id/groups avec 308',
    async (method) => {
      const res = await app.inject({ method, url: `${API}/instances/${INSTANCE}/groups` });
      expect(res.statusCode).toBe(308);
      expect(res.headers.location).toBe(`${API}/instances/${INSTANCE}/layer-groups`);
      expect(res.headers.deprecation).toBe('true');
    },
  );

  it('redirige un sous-chemin avec identifiant', async () => {
    const res = await app.inject({ method: 'PATCH', url: `${API}/instances/${INSTANCE}/groups/${GROUP}` });
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe(`${API}/instances/${INSTANCE}/layer-groups/${GROUP}`);
  });

  it('redirige les sous-groupes', async () => {
    const res = await app.inject({ method: 'GET', url: `${API}/groups/${GROUP}/sub-groups` });
    expect(res.statusCode).toBe(308);
    expect(res.headers.location).toBe(`${API}/layer-groups/${GROUP}/layer-sub-groups`);
  });
});
