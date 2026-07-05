import fs from 'node:fs';
import path from 'node:path';

// Initialize OpenTelemetry tracing BEFORE other imports
import { initTracing } from './infrastructure/observability/tracing.js';
await initTracing();

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { appConfig } from './config/app.config.js';
import { logger } from './infrastructure/observability/logger.js';
import { setupContainer } from './container.js';
import { swaggerPlugin } from './presentation/plugins/swagger.plugin.js';
import { corsPlugin } from './presentation/plugins/cors.plugin.js';
import { authPlugin } from './presentation/plugins/auth.plugin.js';
import { websocketPlugin } from './presentation/plugins/websocket.plugin.js';
import { requestLoggerMiddleware } from './presentation/middleware/request-logger.middleware.js';
import { metricsMiddleware } from './presentation/middleware/metrics.middleware.js';
import { errorHandler } from './presentation/middleware/error-handler.middleware.js';
import { authRoutes } from './presentation/routes/auth.routes.js';
import { healthRoutes } from './presentation/routes/health.routes.js';
import { userRoutes } from './presentation/routes/user.routes.js';
import { instanceRoutes } from './presentation/routes/instance.routes.js';
import { groupRoutes } from './presentation/routes/group.routes.js';
import { subGroupRoutes } from './presentation/routes/sub-group.routes.js';
import { layerRoutes } from './presentation/routes/layer.routes.js';
import { baseMapRoutes } from './presentation/routes/base-map.routes.js';
import { styleRoutes } from './presentation/routes/style.routes.js';
import { exportRoutes } from './presentation/routes/export.routes.js';
import { locationPlanRoutes } from './presentation/routes/location-plan.routes.js';
import { geocodingRoutes } from './presentation/routes/geocoding.routes.js';
import { routingRoutes } from './presentation/routes/routing.routes.js';
import { searchRoutes } from './presentation/routes/search.routes.js';
import { qgisProjectRoutes } from './presentation/routes/qgis-project.routes.js';
import { wmsProxyRoutes, wfsProxyRoutes } from './presentation/routes/wms-proxy.routes.js';
import { defaultThemeRoutes } from './presentation/routes/default-theme.routes.js';
import { adminRoutes } from './presentation/routes/admin.routes.js';
import { osmRoutes } from './presentation/routes/osm.routes.js';
import { multipartPlugin } from './presentation/plugins/multipart.plugin.js';
import { uploadRoutes } from './presentation/routes/upload.routes.js';
import { featureRoutes } from './presentation/routes/feature.routes.js';
import { geoportailRoutes } from './presentation/routes/geoportail.routes.js';
import { drawingRoutes } from './presentation/routes/drawing.routes.js';
import { geosignetRoutes } from './presentation/routes/geosignet.routes.js';
import { commentRoutes } from './presentation/routes/comment.routes.js';
import { sharingRoutes } from './presentation/routes/sharing.routes.js';
import { analyticsRoutes } from './presentation/routes/analytics.routes.js';
import { catalogRoutes } from './presentation/routes/catalog.routes.js';
import { mapCompositionRoutes } from './presentation/routes/map-composition.routes.js';
import { documentRoutes } from './presentation/routes/document.routes.js';
import { seoRoutes } from './presentation/routes/seo.routes.js';
import { adressageRoutes } from './presentation/routes/adressage.routes.js';
import { analysisRoutes } from './presentation/routes/analysis.routes.js';
import { rasterRoutes } from './presentation/routes/raster.routes.js';
import { createLayerImportProcessor } from './infrastructure/queue/workers/layer-import.worker.js';
import { createExportProcessor } from './infrastructure/queue/workers/export.worker.js';
import { createLocationPlanProcessor } from './infrastructure/queue/workers/location-plan.worker.js';
import { createScheduledOsmImportProcessor } from './infrastructure/queue/workers/scheduled-osm-import.worker.js';
import { config as envConfig } from './config/env.config.js';

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler(errorHandler);

  await app.register(fastifyHelmet, { 
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  });
  await corsPlugin(app);
  await swaggerPlugin(app);
  await authPlugin(app);
  await websocketPlugin(app);
  await multipartPlugin(app);

  await app.register(fastifyRateLimit, {
    max: appConfig.rateLimit.authenticated,
    timeWindow: appConfig.rateLimit.windowMs,
  });

  await requestLoggerMiddleware(app);
  if (appConfig.prometheus.enabled) {
    await metricsMiddleware(app);
  }

  await setupContainer(app);

  // S'assure que le bucket MinIO existe (jamais créé automatiquement sinon -
  // les exports échouaient avec "The specified bucket does not exist").
  const bootstrapStorageService = app.diContainer.resolve('storageService') as import('./infrastructure/storage/minio.service.js').MinioStorageService;
  await bootstrapStorageService.ensureBucket();

  // Register WebSocket notification routes
  const notificationService = app.diContainer.resolve('notificationService') as import('./infrastructure/websocket/notification.service.js').NotificationService;
  notificationService.registerRoutes(app);

  // Register layer import worker
  const queueService = app.diContainer.resolve('queueService') as import('./infrastructure/queue/queue.service.js').QueueService;
  queueService.createQueue('layer-import');
  queueService.registerWorker('layer-import', createLayerImportProcessor({
    exportRepository: app.diContainer.resolve('exportRepository') as import('./infrastructure/database/repositories/prisma-export.repository.js').PrismaExportRepository,
    layerRepository: app.diContainer.resolve('layerRepository') as import('./infrastructure/database/repositories/prisma-layer.repository.js').PrismaLayerRepository,
    storageService: app.diContainer.resolve('storageService') as import('./infrastructure/storage/minio.service.js').MinioStorageService,
    notificationService,
    postGISService: app.diContainer.resolve('postGISService') as import('./infrastructure/database/postgis.service.js').PostGISService,
    ogr2ogrService: app.diContainer.resolve('ogr2ogrService') as import('./infrastructure/gdal/ogr2ogr.service.js').Ogr2OgrService,
  }));

  // Register export worker
  queueService.createQueue('layer-export');
  queueService.registerWorker('layer-export', createExportProcessor({
    exportRepository: app.diContainer.resolve('exportRepository') as import('./infrastructure/database/repositories/prisma-export.repository.js').PrismaExportRepository,
    layerRepository: app.diContainer.resolve('layerRepository') as import('./infrastructure/database/repositories/prisma-layer.repository.js').PrismaLayerRepository,
    storageService: app.diContainer.resolve('storageService') as import('./infrastructure/storage/minio.service.js').MinioStorageService,
    notificationService,
    ogr2ogrService: app.diContainer.resolve('ogr2ogrService') as import('./infrastructure/gdal/ogr2ogr.service.js').Ogr2OgrService,
  }));

  // Register location plan worker (génération PDF via QGIS, cf. python_scripts/generate_location_plan.py)
  queueService.createQueue('location-plan');
  queueService.registerWorker('location-plan', createLocationPlanProcessor({
    locationPlanRepository: app.diContainer.resolve('locationPlanRepository') as import('./infrastructure/database/repositories/prisma-location-plan.repository.js').PrismaLocationPlanRepository,
    storageService: app.diContainer.resolve('storageService') as import('./infrastructure/storage/minio.service.js').MinioStorageService,
    notificationService,
    qgisProjectService: app.diContainer.resolve('qgisProjectService') as import('./infrastructure/qgis/qgis-project.service.js').QGISProjectService,
  }));

  // Register scheduled OSM import worker + job récurrent (ré-import mensuel des données
  // OSM brutes + resynchronisation des couches par défaut de toutes les instances actives).
  queueService.createQueue('scheduled-osm-import');
  queueService.registerWorker('scheduled-osm-import', createScheduledOsmImportProcessor({
    scheduledOsmImportUseCase: app.diContainer.resolve('scheduledOsmImportUseCase') as import('./application/use-cases/admin/scheduled-osm-import.use-case.js').ScheduledOsmImportUseCase,
  }));
  await queueService.addRepeatableJob('scheduled-osm-import', 'monthly-import', {}, envConfig.OSM_IMPORT_CRON);

  // Route publique pour servir les icônes SVG personnalisées des couches
  app.get('/api/v1/layers/icons/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const iconPath = path.join('/projects/icons', filename);
    if (!fs.existsSync(iconPath)) {
      return reply.status(404).send({ error: 'Icon not found' });
    }
    const content = fs.readFileSync(iconPath);
    reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    reply.type('image/svg+xml');
    return reply.send(content);
  });

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: `${appConfig.apiPrefix}/auth` });
  await app.register(userRoutes, { prefix: `${appConfig.apiPrefix}/users` });
  await app.register(instanceRoutes, { prefix: `${appConfig.apiPrefix}/instances` });
  await app.register(groupRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/groups` });
  await app.register(subGroupRoutes, { prefix: `${appConfig.apiPrefix}/groups/:groupId/sub-groups` });
  await app.register(layerRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/layers` });
  await app.register(baseMapRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/base-maps` });
  await app.register(styleRoutes, { prefix: `${appConfig.apiPrefix}/layers/:layerId/style` });
  await app.register(exportRoutes, { prefix: `${appConfig.apiPrefix}/exports` });
  await app.register(locationPlanRoutes, { prefix: `${appConfig.apiPrefix}/location-plans` });
  await app.register(geocodingRoutes, { prefix: `${appConfig.apiPrefix}/geocode` });
  await app.register(routingRoutes, { prefix: `${appConfig.apiPrefix}/routing` });
  await app.register(searchRoutes, { prefix: `${appConfig.apiPrefix}/search` });
  await app.register(qgisProjectRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/qgis-project` });
  await app.register(wmsProxyRoutes, { prefix: `${appConfig.apiPrefix}/wms` });
  await app.register(wfsProxyRoutes, { prefix: `${appConfig.apiPrefix}/wfs` });
  await app.register(defaultThemeRoutes, { prefix: `${appConfig.apiPrefix}/default-themes` });
  await app.register(adminRoutes, { prefix: `${appConfig.apiPrefix}/admin` });
  await app.register(osmRoutes, { prefix: `${appConfig.apiPrefix}/osm` });
  await app.register(uploadRoutes, { prefix: `${appConfig.apiPrefix}/layers` });
  await app.register(featureRoutes, { prefix: `${appConfig.apiPrefix}/layers/:layerId/features` });
  await app.register(geoportailRoutes, { prefix: `${appConfig.apiPrefix}/geoportail` });
  await app.register(drawingRoutes, { prefix: `${appConfig.apiPrefix}/drawings` });
  await app.register(geosignetRoutes, { prefix: `${appConfig.apiPrefix}/geosignets` });
  await app.register(commentRoutes, { prefix: `${appConfig.apiPrefix}/comments` });
  await app.register(sharingRoutes, { prefix: `${appConfig.apiPrefix}/share` });
  await app.register(analyticsRoutes, { prefix: `${appConfig.apiPrefix}/analytics` });
  await app.register(catalogRoutes, { prefix: `${appConfig.apiPrefix}/catalog` });
  await app.register(mapCompositionRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/maps` });
  await app.register(documentRoutes, { prefix: `${appConfig.apiPrefix}/documents` });
  await app.register(seoRoutes, { prefix: `${appConfig.apiPrefix}/seo` });
  await app.register(adressageRoutes, { prefix: `${appConfig.apiPrefix}/adressage` });
  await app.register(analysisRoutes, { prefix: `${appConfig.apiPrefix}/analysis` });
  await app.register(rasterRoutes, { prefix: `${appConfig.apiPrefix}/rasters` });

  await app.ready();

  const address = await app.listen({ port: appConfig.port, host: appConfig.host });
  logger.info(`Server started at ${address}`);

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully`);
      await app.close();
      process.exit(0);
    });
  }
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { error: error instanceof Error ? error.message : error });
  process.exit(1);
});
