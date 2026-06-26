import { describe, it, expect, afterAll, beforeAll } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

describe.skipIf(shouldSkip)('App Boot Integration', () => {
  let app: any;

  beforeAll(async () => {
    // Dynamic imports to avoid loading env.config.ts when DATABASE_URL is not set
    const { default: Fastify } = await import('fastify');
    const { default: fastifyHelmet } = await import('@fastify/helmet');
    const { default: fastifyRateLimit } = await import('@fastify/rate-limit');
    const { setupContainer } = await import('../../src/container.js');
    const { corsPlugin } = await import('../../src/presentation/plugins/cors.plugin.js');
    const { swaggerPlugin } = await import('../../src/presentation/plugins/swagger.plugin.js');
    const { authPlugin } = await import('../../src/presentation/plugins/auth.plugin.js');
    const { websocketPlugin } = await import('../../src/presentation/plugins/websocket.plugin.js');
    const { multipartPlugin } = await import('../../src/presentation/plugins/multipart.plugin.js');
    const { healthRoutes } = await import('../../src/presentation/routes/health.routes.js');
    const { authRoutes } = await import('../../src/presentation/routes/auth.routes.js');
    const { userRoutes } = await import('../../src/presentation/routes/user.routes.js');
    const { instanceRoutes } = await import('../../src/presentation/routes/instance.routes.js');
    const { groupRoutes } = await import('../../src/presentation/routes/group.routes.js');
    const { subGroupRoutes } = await import('../../src/presentation/routes/sub-group.routes.js');
    const { layerRoutes } = await import('../../src/presentation/routes/layer.routes.js');
    const { baseMapRoutes } = await import('../../src/presentation/routes/base-map.routes.js');
    const { styleRoutes } = await import('../../src/presentation/routes/style.routes.js');
    const { exportRoutes } = await import('../../src/presentation/routes/export.routes.js');
    const { geocodingRoutes } = await import('../../src/presentation/routes/geocoding.routes.js');
    const { routingRoutes } = await import('../../src/presentation/routes/routing.routes.js');
    const { searchRoutes } = await import('../../src/presentation/routes/search.routes.js');
    const { qgisProjectRoutes } = await import('../../src/presentation/routes/qgis-project.routes.js');
    const { wmsProxyRoutes, wfsProxyRoutes } = await import('../../src/presentation/routes/wms-proxy.routes.js');
    const { defaultThemeRoutes } = await import('../../src/presentation/routes/default-theme.routes.js');
    const { adminRoutes } = await import('../../src/presentation/routes/admin.routes.js');
    const { osmRoutes } = await import('../../src/presentation/routes/osm.routes.js');
    const { uploadRoutes } = await import('../../src/presentation/routes/upload.routes.js');
    const { featureRoutes } = await import('../../src/presentation/routes/feature.routes.js');
    const { geoportailRoutes } = await import('../../src/presentation/routes/geoportail.routes.js');
    const { drawingRoutes } = await import('../../src/presentation/routes/drawing.routes.js');
    const { sharingRoutes } = await import('../../src/presentation/routes/sharing.routes.js');
    const { analyticsRoutes } = await import('../../src/presentation/routes/analytics.routes.js');
    const { catalogRoutes } = await import('../../src/presentation/routes/catalog.routes.js');
    const { mapCompositionRoutes } = await import('../../src/presentation/routes/map-composition.routes.js');
    const { documentRoutes } = await import('../../src/presentation/routes/document.routes.js');
    const { seoRoutes } = await import('../../src/presentation/routes/seo.routes.js');
    const { adressageRoutes } = await import('../../src/presentation/routes/adressage.routes.js');
    const { analysisRoutes } = await import('../../src/presentation/routes/analysis.routes.js');
    const { rasterRoutes } = await import('../../src/presentation/routes/raster.routes.js');
    const { appConfig } = await import('../../src/config/app.config.js');

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
    if (app) await app.close();
  });

  it('should start without throwing', () => {
    expect(app).toBeDefined();
  });

  it('should have routes registered', () => {
    const routeList = app.printRoutes({ commonPrefix: false });
    expect(routeList).toBeTruthy();
    expect(routeList).toContain('/health');
  });

  it('should respond 200 on /health', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data.status).toBe('ok');
  });

  it('should respond on /health/live', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/live' });
    expect(response.statusCode).toBe(200);
  });
});
