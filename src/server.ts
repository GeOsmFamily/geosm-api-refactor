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

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler(errorHandler);

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await corsPlugin(app);
  await swaggerPlugin(app);
  await authPlugin(app);
  await websocketPlugin(app);

  await app.register(fastifyRateLimit, {
    max: appConfig.rateLimit.authenticated,
    timeWindow: appConfig.rateLimit.windowMs,
  });

  await requestLoggerMiddleware(app);
  if (appConfig.prometheus.enabled) {
    await metricsMiddleware(app);
  }

  await setupContainer(app);

  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: `${appConfig.apiPrefix}/auth` });
  await app.register(userRoutes, { prefix: `${appConfig.apiPrefix}/users` });
  await app.register(instanceRoutes, { prefix: `${appConfig.apiPrefix}/instances` });
  await app.register(groupRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/groups` });
  await app.register(subGroupRoutes, { prefix: `${appConfig.apiPrefix}/groups/:groupId/sub-groups` });
  await app.register(layerRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/layers` });
  await app.register(baseMapRoutes, { prefix: `${appConfig.apiPrefix}/instances/:instanceId/base-maps` });

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
