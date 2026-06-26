import { describe, it, expect, afterAll, beforeAll } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

describe.skipIf(shouldSkip)('Basic Load Test', () => {
  let app: any;

  beforeAll(async () => {
    const { default: Fastify } = await import('fastify');
    const { setupContainer } = await import('../../src/container.js');
    const { healthRoutes } = await import(
      '../../src/presentation/routes/health.routes.js'
    );

    app = Fastify({ logger: false });
    await setupContainer(app);
    await app.register(healthRoutes);
    await app.ready();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should handle 100 concurrent /health requests within latency budget', async () => {
    const concurrency = 100;

    const results = await Promise.all(
      Array.from({ length: concurrency }, async () => {
        const start = performance.now();
        const response = await app.inject({ method: 'GET', url: '/health' });
        const elapsed = performance.now() - start;
        return { statusCode: response.statusCode, elapsed };
      }),
    );

    // All requests must succeed
    const failures = results.filter((r) => r.statusCode !== 200);
    expect(failures).toHaveLength(0);

    // Compute percentiles
    const times = results.map((r) => r.elapsed).sort((a, b) => a - b);
    const p50 = percentile(times, 50);
    const p95 = percentile(times, 95);
    const p99 = percentile(times, 99);

    console.log(
      `Load test results (n=${concurrency}): p50=${p50.toFixed(1)}ms  p95=${p95.toFixed(1)}ms  p99=${p99.toFixed(1)}ms`,
    );

    // p95 should be under 200ms for an in-process inject call
    expect(p95).toBeLessThan(200);
  });
});
