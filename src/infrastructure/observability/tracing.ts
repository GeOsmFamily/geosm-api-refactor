import { logger } from './logger.js';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME || 'geosm-api';

export async function initTracing(): Promise<void> {
  if (!endpoint) {
    logger.info('OpenTelemetry tracing disabled (OTEL_EXPORTER_OTLP_ENDPOINT not set)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
    const { resourceFromAttributes } = await import('@opentelemetry/resources');

    const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: '1.0.0',
        'deployment.environment': process.env.NODE_ENV || 'development',
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: true },
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-ioredis': { enabled: true },
        }),
      ],
    });

    sdk.start();

    const shutdown = async () => {
      try {
        await sdk.shutdown();
        logger.info('OpenTelemetry SDK shut down');
      } catch (err) {
        logger.error('Error shutting down OpenTelemetry SDK', { error: err instanceof Error ? err.message : String(err) });
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    logger.info('OpenTelemetry tracing initialized', { endpoint, serviceName });
  } catch (err) {
    logger.warn('Failed to initialize OpenTelemetry tracing', { error: err instanceof Error ? err.message : String(err) });
  }
}
