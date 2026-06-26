import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { setupContainer } from '../../src/container.js';
import { corsPlugin } from '../../src/presentation/plugins/cors.plugin.js';
import { swaggerPlugin } from '../../src/presentation/plugins/swagger.plugin.js';
import { authPlugin } from '../../src/presentation/plugins/auth.plugin.js';
import { websocketPlugin } from '../../src/presentation/plugins/websocket.plugin.js';
import { multipartPlugin } from '../../src/presentation/plugins/multipart.plugin.js';
import { healthRoutes } from '../../src/presentation/routes/health.routes.js';
import { authRoutes } from '../../src/presentation/routes/auth.routes.js';
import { userRoutes } from '../../src/presentation/routes/user.routes.js';
import { instanceRoutes } from '../../src/presentation/routes/instance.routes.js';
import { groupRoutes } from '../../src/presentation/routes/group.routes.js';
import { subGroupRoutes } from '../../src/presentation/routes/sub-group.routes.js';
import { layerRoutes } from '../../src/presentation/routes/layer.routes.js';
import { baseMapRoutes } from '../../src/presentation/routes/base-map.routes.js';
import { styleRoutes } from '../../src/presentation/routes/style.routes.js';
import { exportRoutes } from '../../src/presentation/routes/export.routes.js';
import { geocodingRoutes } from '../../src/presentation/routes/geocoding.routes.js';
import { routingRoutes } from '../../src/presentation/routes/routing.routes.js';
import { searchRoutes } from '../../src/presentation/routes/search.routes.js';
import { qgisProjectRoutes } from '../../src/presentation/routes/qgis-project.routes.js';
import { wmsProxyRoutes, wfsProxyRoutes } from '../../src/presentation/routes/wms-proxy.routes.js';
import { defaultThemeRoutes } from '../../src/presentation/routes/default-theme.routes.js';
import { adminRoutes } from '../../src/presentation/routes/admin.routes.js';
import { osmRoutes } from '../../src/presentation/routes/osm.routes.js';
import { uploadRoutes } from '../../src/presentation/routes/upload.routes.js';
import { featureRoutes } from '../../src/presentation/routes/feature.routes.js';
import { geoportailRoutes } from '../../src/presentation/routes/geoportail.routes.js';
import { drawingRoutes } from '../../src/presentation/routes/drawing.routes.js';
import { sharingRoutes } from '../../src/presentation/routes/sharing.routes.js';
import { analyticsRoutes } from '../../src/presentation/routes/analytics.routes.js';
import { catalogRoutes } from '../../src/presentation/routes/catalog.routes.js';
import { mapCompositionRoutes } from '../../src/presentation/routes/map-composition.routes.js';
import { documentRoutes } from '../../src/presentation/routes/document.routes.js';
import { seoRoutes } from '../../src/presentation/routes/seo.routes.js';
import { adressageRoutes } from '../../src/presentation/routes/adressage.routes.js';
import { analysisRoutes } from '../../src/presentation/routes/analysis.routes.js';
import { rasterRoutes } from '../../src/presentation/routes/raster.routes.js';
import { appConfig } from '../../src/config/app.config.js';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

describe.skipIf(shouldSkip)('App Boot Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    await app.register(fastifyHelmet, { contentSecurityPolicy: false });
    await corsPlugin(app);
    await swaggerPlugin(app);
    await authPlugin(app);
    await websocketPlugin(app);
    await multipartPlugin(app);

    await app.register(fastifyRateLimit, {
      max: appConfig.rateLimit.authenticated,
      timeWindow: appConfig.rateLimit.windowMs,
    });

    await setupContainer(app);

    const prefix = appConfig.apiPrefix;

    await app.register(healthRoutes);
    await app.register(authRoutes, { prefix: `${prefix}/auth` });
    await app.register(userRoutes, { prefix: `${prefix}/users` });
    await app.register(instanceRoutes, { prefix: `${prefix}/instances` });
    await app.register(groupRoutes, { prefix: `${prefix}/instances/:instanceId/groups` });
    await app.register(subGroupRoutes, { prefix: `${prefix}/groups/:groupId/sub-groups` });
    await app.register(layerRoutes, { prefix: `${prefix}/instances/:instanceId/layers` });
    await app.register(baseMapRoutes, { prefix: `${prefix}/instances/:instanceId/base-maps` });
    await app.register(styleRoutes, { prefix: `${prefix}/layers/:layerId/style` });
    await app.register(exportRoutes, { prefix: `${prefix}/exports` });
    await app.register(geocodingRoutes, { prefix: `${prefix}/geocode` });
    await app.register(routingRoutes, { prefix: `${prefix}/routing` });
    await app.register(searchRoutes, { prefix: `${prefix}/search` });
    await app.register(qgisProjectRoutes, { prefix: `${prefix}/instances/:instanceId/qgis-project` });
    await app.register(wmsProxyRoutes, { prefix: `${prefix}/wms` });
    await app.register(wfsProxyRoutes, { prefix: `${prefix}/wfs` });
    await app.register(defaultThemeRoutes, { prefix: `${prefix}/default-themes` });
    await app.register(adminRoutes, { prefix: `${prefix}/admin` });
    await app.register(osmRoutes, { prefix: `${prefix}/osm` });
    await app.register(uploadRoutes, { prefix: `${prefix}/layers` });
    await app.register(featureRoutes, { prefix: `${prefix}/layers/:layerId/features` });
    await app.register(geoportailRoutes, { prefix: `${prefix}/geoportail` });
    await app.register(drawingRoutes, { prefix: `${prefix}/drawings` });
    await app.register(sharingRoutes, { prefix: `${prefix}/share` });
    await app.register(analyticsRoutes, { prefix: `${prefix}/analytics` });
    await app.register(catalogRoutes, { prefix: `${prefix}/catalog` });
    await app.register(mapCompositionRoutes, { prefix: `${prefix}/instances/:instanceId/maps` });
    await app.register(documentRoutes, { prefix: `${prefix}/documents` });
    await app.register(seoRoutes, { prefix: `${prefix}/seo` });
    await app.register(adressageRoutes, { prefix: `${prefix}/adressage` });
    await app.register(analysisRoutes, { prefix: `${prefix}/analysis` });
    await app.register(rasterRoutes, { prefix: `${prefix}/rasters` });

    await app.ready();
  }, 30_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should start without throwing', () => {
    expect(app).toBeDefined();
  });

  it('should have routes registered', () => {
    const routeList = app.printRoutes({ commonPrefix: false });
    expect(routeList).toBeTruthy();
    expect(routeList).toContain('/health');
  });

  it('should have registered all expected route prefixes', () => {
    const routeList = app.printRoutes({ commonPrefix: false });
    const expectedPaths = [
      '/health',
      `${appConfig.apiPrefix}/auth`,
      `${appConfig.apiPrefix}/users`,
      `${appConfig.apiPrefix}/instances`,
    ];
    for (const path of expectedPaths) {
      expect(routeList).toContain(path);
    }
  });

  it('should respond 200 on /health', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.status).toBe('ok');
  });

  it('should respond on /health/live', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health/live',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.status).toBe('live');
  });
});
