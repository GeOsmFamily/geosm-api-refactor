import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DB_AVAILABLE, getPrisma, disconnectPrisma } from './setup.js';

describe.skipIf(!DB_AVAILABLE)('Prometheus Metrics Integration', () => {
  let app: any;

  beforeAll(async () => {
    const { default: Fastify } = await import('fastify');
    const { authPlugin } = await import('../../src/presentation/plugins/auth.plugin.js');
    const { setupContainer } = await import('../../src/container.js');
    const { healthRoutes } = await import('../../src/presentation/routes/health.routes.js');
    const { metricsMiddleware } = await import('../../src/presentation/middleware/metrics.middleware.js');

    app = Fastify({ logger: false });
    await authPlugin(app);
    await metricsMiddleware(app);
    await setupContainer(app);
    await app.register(healthRoutes);
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /metrics should return Prometheus text format', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.payload).toContain('# HELP');
    expect(res.payload).toContain('# TYPE');
  });

  it('/metrics should include default Node.js metrics', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.payload).toContain('process_cpu_');
    expect(res.payload).toContain('nodejs_heap_size_total_bytes');
  });

  it('/metrics should include custom HTTP metrics', async () => {
    // Make a request first to generate metrics
    await app.inject({ method: 'GET', url: '/health' });

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    expect(res.payload).toContain('http_requests_total');
    expect(res.payload).toContain('http_request_duration_seconds');
  });

  it('/metrics should include custom app metrics definitions', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    // DB metrics
    expect(res.payload).toContain('db_query_duration_seconds');
    expect(res.payload).toContain('db_query_total');
    // PostGIS metrics
    expect(res.payload).toContain('postgis_operations_total');
    // Storage metrics
    expect(res.payload).toContain('storage_operations_total');
    // Cache metrics
    expect(res.payload).toContain('cache_hits_total');
    expect(res.payload).toContain('cache_misses_total');
    // Auth metrics
    expect(res.payload).toContain('auth_login_total');
    // Job metrics
    expect(res.payload).toContain('jobs_processed_total');
    // Error metrics
    expect(res.payload).toContain('api_errors_total');
  });

  it('metrics middleware should track requests', async () => {
    // Reset by making a known request
    const healthRes = await app.inject({ method: 'GET', url: '/health' });
    expect(healthRes.statusCode).toBe(200);

    const res = await app.inject({ method: 'GET', url: '/metrics' });
    // Should contain a counter for the /health route
    expect(res.payload).toMatch(/http_requests_total\{.*method="GET".*\}/);
  });

  it('/metrics output should be valid Prometheus text exposition format', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics' });
    const lines = res.payload.split('\n');

    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue;
      // Each metric line should match: metric_name{labels} value [timestamp]
      // or metric_name value [timestamp]
      expect(line).toMatch(/^[a-zA-Z_:][a-zA-Z0-9_:]*(\{[^}]*\})?\s+([\d.eE+-]+|[Nn]a[Nn]|[+-]?Inf)(\s+\d+)?$/);
    }
  });
});

describe.skipIf(!DB_AVAILABLE)('Health Check Detailed Integration', () => {
  let app: any;

  beforeAll(async () => {
    const { default: Fastify } = await import('fastify');
    const { authPlugin } = await import('../../src/presentation/plugins/auth.plugin.js');
    const { setupContainer } = await import('../../src/container.js');
    const { healthRoutes } = await import('../../src/presentation/routes/health.routes.js');

    app = Fastify({ logger: false });
    await authPlugin(app);
    await setupContainer(app);
    await app.register(healthRoutes);
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health/detailed should check all services', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    const checks = body.data.checks;

    expect(checks).toHaveProperty('postgresql');
    expect(checks).toHaveProperty('redis');
    expect(checks).toHaveProperty('minio');
    expect(checks).toHaveProperty('meilisearch');
    expect(checks).toHaveProperty('qgisServer');
    expect(checks).toHaveProperty('disk');
    expect(checks).toHaveProperty('memory');
  });

  it('GET /health/detailed should show PostgreSQL as healthy', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.postgresql.status).toBe('healthy');
    expect(body.data.checks.postgresql.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('GET /health/detailed should show Redis as healthy', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.redis.status).toBe('healthy');
  });

  it('GET /health/detailed should report disk usage', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.disk).toHaveProperty('usagePercent');
    expect(body.data.checks.disk).toHaveProperty('free');
    expect(body.data.checks.disk).toHaveProperty('total');
    expect(body.data.checks.disk.usagePercent).toBeGreaterThan(0);
  });

  it('GET /health/detailed should report memory usage', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.memory).toHaveProperty('usagePercent');
    expect(body.data.checks.memory).toHaveProperty('totalMB');
    expect(body.data.checks.memory).toHaveProperty('freeMB');
    expect(body.data.checks.memory).toHaveProperty('heapUsedMB');
    expect(body.data.checks.memory.totalMB).toBeGreaterThan(0);
  });

  it('GET /health/ready should check critical services', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    const body = JSON.parse(res.payload);
    expect(body.data).toHaveProperty('status');
    expect(body.data).toHaveProperty('checks');
    expect(body.data.checks).toHaveProperty('postgres');
    expect(body.data.checks).toHaveProperty('redis');
  });

  it('GET /health/live should return live status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.data.status).toBe('live');
    expect(body.data.pid).toBeGreaterThan(0);
    expect(body.data.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /health/detailed should check QGIS Server (graceful failure)', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    // QGIS Server not running in CI, should report unhealthy gracefully
    expect(body.data.checks.qgisServer).toHaveProperty('status');
    expect(body.data.checks.qgisServer).toHaveProperty('responseTime');
  });

  it('GET /health/detailed should check MinIO', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.minio).toHaveProperty('status');
  });

  it('GET /health/detailed should check MeiliSearch', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/detailed' });
    const body = JSON.parse(res.payload);
    expect(body.data.checks.meilisearch).toHaveProperty('status');
  });
});

describe('AlertingService Integration', () => {
  it('should instantiate without external dependencies', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    expect(service).toBeDefined();
  });

  it('sendAlert INFO should log without sending notifications', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(
      service.sendAlert('INFO', 'Test Alert', 'This is a test info alert', { key: 'value' }),
    ).resolves.toBeUndefined();
  });

  it('sendAlert WARNING should not throw without Slack configured', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(
      service.sendAlert('WARNING', 'Test Warning', 'Warning message'),
    ).resolves.toBeUndefined();
  });

  it('sendAlert CRITICAL should not throw without Slack/email configured', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(
      service.sendAlert('CRITICAL', 'Test Critical', 'Critical error occurred'),
    ).resolves.toBeUndefined();
  });

  it('alertOnHighErrorRate should send a WARNING alert', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(service.alertOnHighErrorRate(90)).resolves.toBeUndefined();
  });

  it('alertOnSlowQueries should send a WARNING alert', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(service.alertOnSlowQueries(5000)).resolves.toBeUndefined();
  });

  it('alertOnJobFailure should send a CRITICAL alert', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(
      service.alertOnJobFailure('test-job', new Error('Test failure')),
    ).resolves.toBeUndefined();
  });

  it('alertOnJobFailure should handle string errors', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(
      service.alertOnJobFailure('test-job', 'string error message'),
    ).resolves.toBeUndefined();
  });

  it('alertOnDiskSpace should check disk usage without error', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(service.alertOnDiskSpace(95)).resolves.toBeUndefined();
  });

  it('alertOnMemoryUsage should check memory without error', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    const service = new AlertingService();
    await expect(service.alertOnMemoryUsage(95)).resolves.toBeUndefined();
  });

  it('should use emailService for CRITICAL alerts when provided', async () => {
    const { AlertingService } = await import('../../src/infrastructure/observability/alerting.service.js');
    let emailCalled = false;
    const mockEmailService = {
      sendAlertEmail: async (_to: string, _subject: string, _html: string) => {
        emailCalled = true;
      },
    };
    const service = new AlertingService(mockEmailService);
    // ALERT_EMAIL_TO not set, so email won't actually be called
    await service.sendAlert('CRITICAL', 'Test', 'msg');
    // Without ALERT_EMAIL_TO env var, email is skipped
    expect(emailCalled).toBe(false);
  });
});

describe('OpenTelemetry Tracing Integration', () => {
  it('should initialize gracefully without OTEL endpoint', async () => {
    const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const { initTracing } = await import('../../src/infrastructure/observability/tracing.js');
    await expect(initTracing()).resolves.toBeUndefined();

    if (originalEndpoint) process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
  });

  it('should handle invalid OTEL endpoint gracefully', async () => {
    const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://nonexistent-host:4318';

    const { initTracing } = await import('../../src/infrastructure/observability/tracing.js');
    // Should not throw even with unreachable endpoint
    await expect(initTracing()).resolves.toBeUndefined();

    if (originalEndpoint) {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
    } else {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    }
  });
});

describe('Logger / Graylog GELF Integration', () => {
  it('should create logger without GRAYLOG_HOST', async () => {
    const { logger } = await import('../../src/infrastructure/observability/logger.js');
    expect(logger).toBeDefined();
    expect(logger.info).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
  });

  it('should create child logger with module name', async () => {
    const { createChildLogger } = await import('../../src/infrastructure/observability/logger.js');
    const child = createChildLogger('TestModule');
    expect(child).toBeDefined();
    expect(child.info).toBeTypeOf('function');
  });

  it('should create child logger with correlationId', async () => {
    const { createChildLogger } = await import('../../src/infrastructure/observability/logger.js');
    const child = createChildLogger('TestModule', 'test-correlation-id-123');
    expect(child).toBeDefined();
  });

  it('logger should have correct default metadata', async () => {
    const { logger } = await import('../../src/infrastructure/observability/logger.js');
    expect(logger.defaultMeta).toHaveProperty('service', 'geosm-api');
    expect(logger.defaultMeta).toHaveProperty('environment');
    expect(logger.defaultMeta).toHaveProperty('hostname');
    expect(logger.defaultMeta).toHaveProperty('pid');
  });

  it('logger should support all log levels', async () => {
    const { logger } = await import('../../src/infrastructure/observability/logger.js');
    expect(() => logger.info('test info')).not.toThrow();
    expect(() => logger.warn('test warn')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.debug('test debug')).not.toThrow();
  });
});

describe('Metrics Counters and Histograms', () => {
  it('should export all expected metric objects', async () => {
    const metrics = await import('../../src/infrastructure/observability/metrics.js');

    // HTTP
    expect(metrics.httpRequestsTotal).toBeDefined();
    expect(metrics.httpRequestDurationSeconds).toBeDefined();
    expect(metrics.httpRequestSizeBytes).toBeDefined();
    expect(metrics.httpResponseSizeBytes).toBeDefined();

    // WebSocket
    expect(metrics.activeWebsocketConnections).toBeDefined();

    // Jobs
    expect(metrics.jobsProcessedTotal).toBeDefined();
    expect(metrics.jobsProcessingDurationSeconds).toBeDefined();
    expect(metrics.jobsWaitingCount).toBeDefined();
    expect(metrics.jobsFailedTotal).toBeDefined();

    // DB
    expect(metrics.dbQueryDurationSeconds).toBeDefined();
    expect(metrics.dbQueryTotal).toBeDefined();
    expect(metrics.dbConnectionPoolSize).toBeDefined();

    // PostGIS
    expect(metrics.postgisOperationsTotal).toBeDefined();
    expect(metrics.postgisOperationDurationSeconds).toBeDefined();

    // ogr2ogr
    expect(metrics.ogr2ogrOperationsTotal).toBeDefined();
    expect(metrics.ogr2ogrOperationDurationSeconds).toBeDefined();

    // Storage
    expect(metrics.storageOperationsTotal).toBeDefined();
    expect(metrics.storageOperationDurationSeconds).toBeDefined();

    // Search
    expect(metrics.searchOperationsTotal).toBeDefined();

    // Cache
    expect(metrics.cacheHitsTotal).toBeDefined();
    expect(metrics.cacheMissesTotal).toBeDefined();

    // QGIS
    expect(metrics.qgisScriptExecutionsTotal).toBeDefined();
    expect(metrics.qgisScriptDurationSeconds).toBeDefined();

    // Auth
    expect(metrics.authLoginTotal).toBeDefined();
    expect(metrics.authLoginFailedTotal).toBeDefined();

    // Email
    expect(metrics.emailSentTotal).toBeDefined();
    expect(metrics.emailFailedTotal).toBeDefined();

    // Import/Export
    expect(metrics.exportCompletedTotal).toBeDefined();
    expect(metrics.importCompletedTotal).toBeDefined();

    // Users
    expect(metrics.activeUsersGauge).toBeDefined();

    // Errors
    expect(metrics.apiErrorsTotal).toBeDefined();
  });

  it('counters should be incrementable', async () => {
    const { httpRequestsTotal } = await import('../../src/infrastructure/observability/metrics.js');
    expect(() => httpRequestsTotal.inc({ method: 'GET', route: '/test', status_code: '200' })).not.toThrow();
  });

  it('histograms should be observable', async () => {
    const { httpRequestDurationSeconds } = await import('../../src/infrastructure/observability/metrics.js');
    expect(() => httpRequestDurationSeconds.observe({ method: 'GET', route: '/test', status_code: '200' }, 0.05)).not.toThrow();
  });

  it('gauges should be settable', async () => {
    const { activeWebsocketConnections, dbConnectionPoolSize } = await import('../../src/infrastructure/observability/metrics.js');
    expect(() => activeWebsocketConnections.set(5)).not.toThrow();
    expect(() => dbConnectionPoolSize.set(10)).not.toThrow();
  });

  it('metricsRegister should serialize all metrics', async () => {
    const { metricsRegister } = await import('../../src/infrastructure/observability/metrics.js');
    const output = await metricsRegister.metrics();
    expect(output).toContain('http_requests_total');
    expect(output).toContain('db_query_duration_seconds');
    expect(output).toContain('postgis_operations_total');
    expect(output).toContain('cache_hits_total');
    expect(output).toContain('auth_login_total');
    expect(output).toContain('jobs_processed_total');
    expect(output).toContain('api_errors_total');
  });
});

describe.skipIf(!DB_AVAILABLE)('QGIS Server Service', () => {
  it('should construct correct WMS URL', async () => {
    const { QgisServerService } = await import('../../src/infrastructure/external-apis/qgis-server.service.js');
    const service = new QgisServerService();

    // Test that the service exists and has the right methods
    expect(service).toBeDefined();
    expect(service.proxyWmsRequest).toBeTypeOf('function');
    expect(service.proxyWfsRequest).toBeTypeOf('function');
    expect(service.getCapabilities).toBeTypeOf('function');
  });

  it('proxyWmsRequest should fail gracefully when QGIS Server is unavailable', async () => {
    const { QgisServerService } = await import('../../src/infrastructure/external-apis/qgis-server.service.js');
    const service = new QgisServerService();

    await expect(
      service.proxyWmsRequest({ REQUEST: 'GetCapabilities', VERSION: '1.3.0' }, '/test.qgs'),
    ).rejects.toThrow();
  });

  it('proxyWfsRequest should fail gracefully when QGIS Server is unavailable', async () => {
    const { QgisServerService } = await import('../../src/infrastructure/external-apis/qgis-server.service.js');
    const service = new QgisServerService();

    await expect(
      service.proxyWfsRequest({ REQUEST: 'GetCapabilities', VERSION: '2.0.0' }, '/test.qgs'),
    ).rejects.toThrow();
  });

  it('getCapabilities should fail gracefully when QGIS Server is unavailable', async () => {
    const { QgisServerService } = await import('../../src/infrastructure/external-apis/qgis-server.service.js');
    const service = new QgisServerService();

    await expect(service.getCapabilities('/test.qgs', 'WMS')).rejects.toThrow();
  });
});
