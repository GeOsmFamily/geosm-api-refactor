import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

// --- HTTP Metrics ---

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.001, 0.005, 0.015, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestSizeBytes = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP request payloads in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

export const httpResponseSizeBytes = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response payloads in bytes',
  labelNames: ['method', 'route'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// --- WebSocket ---

export const activeWebsocketConnections = new client.Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

// --- Job Queue Metrics ---

export const jobsProcessedTotal = new client.Counter({
  name: 'jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue', 'status'] as const,
  registers: [register],
});

export const jobsProcessingDurationSeconds = new client.Histogram({
  name: 'jobs_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['queue'] as const,
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const jobsWaitingCount = new client.Gauge({
  name: 'jobs_waiting_count',
  help: 'Number of waiting jobs per queue',
  labelNames: ['queue'] as const,
  registers: [register],
});

export const jobsFailedTotal = new client.Counter({
  name: 'jobs_failed_total',
  help: 'Total number of failed jobs',
  labelNames: ['queue'] as const,
  registers: [register],
});

// --- Database Metrics ---

export const dbQueryDurationSeconds = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

export const dbQueryTotal = new client.Counter({
  name: 'db_query_total',
  help: 'Total number of database queries',
  labelNames: ['operation'] as const,
  registers: [register],
});

export const dbConnectionPoolSize = new client.Gauge({
  name: 'db_connection_pool_size',
  help: 'Current database connection pool size',
  registers: [register],
});

// --- PostGIS Metrics ---

export const postgisOperationsTotal = new client.Counter({
  name: 'postgis_operations_total',
  help: 'Total number of PostGIS operations',
  labelNames: ['operation'] as const,
  registers: [register],
});

export const postgisOperationDurationSeconds = new client.Histogram({
  name: 'postgis_operation_duration_seconds',
  help: 'Duration of PostGIS operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
  registers: [register],
});

// --- ogr2ogr Metrics ---

export const ogr2ogrOperationsTotal = new client.Counter({
  name: 'ogr2ogr_operations_total',
  help: 'Total number of ogr2ogr operations',
  labelNames: ['operation'] as const,
  registers: [register],
});

export const ogr2ogrOperationDurationSeconds = new client.Histogram({
  name: 'ogr2ogr_operation_duration_seconds',
  help: 'Duration of ogr2ogr operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.5, 1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [register],
});

// --- Storage (MinIO) Metrics ---

export const storageOperationsTotal = new client.Counter({
  name: 'storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation'] as const,
  registers: [register],
});

export const storageOperationDurationSeconds = new client.Histogram({
  name: 'storage_operation_duration_seconds',
  help: 'Duration of storage operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
  registers: [register],
});

// --- Search (MeiliSearch) Metrics ---

export const searchOperationsTotal = new client.Counter({
  name: 'search_operations_total',
  help: 'Total number of search operations',
  labelNames: ['operation'] as const,
  registers: [register],
});

// --- Cache (Redis) Metrics ---

export const cacheHitsTotal = new client.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register],
});

export const cacheMissesTotal = new client.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register],
});

// --- QGIS Metrics ---

export const qgisScriptExecutionsTotal = new client.Counter({
  name: 'qgis_script_executions_total',
  help: 'Total number of QGIS script executions',
  labelNames: ['script'] as const,
  registers: [register],
});

export const qgisScriptDurationSeconds = new client.Histogram({
  name: 'qgis_script_duration_seconds',
  help: 'Duration of QGIS script executions in seconds',
  labelNames: ['script'] as const,
  buckets: [0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

// --- Auth Metrics ---

export const authLoginTotal = new client.Counter({
  name: 'auth_login_total',
  help: 'Total number of successful logins',
  registers: [register],
});

export const authLoginFailedTotal = new client.Counter({
  name: 'auth_login_failed_total',
  help: 'Total number of failed login attempts',
  registers: [register],
});

// --- Email Metrics ---

export const emailSentTotal = new client.Counter({
  name: 'email_sent_total',
  help: 'Total number of emails sent',
  registers: [register],
});

export const emailFailedTotal = new client.Counter({
  name: 'email_failed_total',
  help: 'Total number of failed email sends',
  registers: [register],
});

// --- Import/Export Metrics ---

export const exportCompletedTotal = new client.Counter({
  name: 'export_completed_total',
  help: 'Total number of completed exports',
  registers: [register],
});

export const importCompletedTotal = new client.Counter({
  name: 'import_completed_total',
  help: 'Total number of completed imports',
  registers: [register],
});

// --- User Metrics ---

export const activeUsersGauge = new client.Gauge({
  name: 'active_users_gauge',
  help: 'Number of currently connected users',
  registers: [register],
});

// --- Error Metrics ---

export const apiErrorsTotal = new client.Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors by type',
  labelNames: ['error_type'] as const,
  registers: [register],
});

// --- Gemini (assistant IA) Metrics ---
// Suivi latence/volume/erreurs des appels Gemini - utile pour surveiller coût et quota API,
// jamais instrumenté auparavant malgré l'usage important (assistant conversationnel,
// synthèse narrative, résumé de vue, rédaction de plans de localisation).

export const geminiCallsTotal = new client.Counter({
  name: 'gemini_calls_total',
  help: 'Total number of Gemini API calls',
  labelNames: ['method', 'status'] as const,
  registers: [register],
});

export const geminiCallDurationSeconds = new client.Histogram({
  name: 'gemini_call_duration_seconds',
  help: 'Duration of Gemini API calls in seconds',
  labelNames: ['method'] as const,
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
  registers: [register],
});

export const metricsRegister = register;
