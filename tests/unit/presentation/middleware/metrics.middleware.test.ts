import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInc, mockObserve } = vi.hoisted(() => ({
  mockInc: vi.fn(),
  mockObserve: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/observability/metrics.js', () => ({
  httpRequestsTotal: { inc: mockInc },
  httpRequestDurationSeconds: { observe: mockObserve },
  httpRequestSizeBytes: { observe: mockObserve },
  httpResponseSizeBytes: { observe: mockObserve },
}));

import { metricsMiddleware } from '../../../../src/presentation/middleware/metrics.middleware.js';

describe('metricsMiddleware', () => {
  let onResponseHook: Function;
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = {
      addHook: vi.fn((name: string, fn: Function) => {
        if (name === 'onResponse') onResponseHook = fn;
      }),
    };
  });

  it('should register an onResponse hook', async () => {
    await metricsMiddleware(app);
    expect(app.addHook).toHaveBeenCalledWith('onResponse', expect.any(Function));
    expect(onResponseHook).toBeDefined();
  });

  it('should increment request counter and observe duration', async () => {
    await metricsMiddleware(app);
    const request = {
      method: 'GET',
      url: '/api/data',
      routeOptions: { url: '/api/data' },
      headers: {},
    };
    const reply = { statusCode: 200, elapsedTime: 150, getHeader: () => undefined };
    await onResponseHook(request, reply);
    expect(mockInc).toHaveBeenCalledWith({ method: 'GET', route: '/api/data', status_code: '200' });
    expect(mockObserve).toHaveBeenCalled();
  });

  it('should track request size when content-length header is present', async () => {
    await metricsMiddleware(app);
    const request = {
      method: 'POST',
      url: '/api/data',
      routeOptions: { url: '/api/data' },
      headers: { 'content-length': '512' },
    };
    const reply = { statusCode: 201, elapsedTime: 50, getHeader: () => undefined };
    await onResponseHook(request, reply);
    expect(mockObserve).toHaveBeenCalledWith({ method: 'POST', route: '/api/data' }, 512);
  });

  it('should track response size when content-length header is present', async () => {
    await metricsMiddleware(app);
    const request = {
      method: 'GET',
      url: '/api/data',
      routeOptions: { url: '/api/data' },
      headers: {},
    };
    const reply = { statusCode: 200, elapsedTime: 30, getHeader: () => '1024' };
    await onResponseHook(request, reply);
    expect(mockObserve).toHaveBeenCalledWith({ method: 'GET', route: '/api/data' }, 1024);
  });

  it('should fall back to request.url when routeOptions is missing', async () => {
    await metricsMiddleware(app);
    const request = {
      method: 'GET',
      url: '/fallback',
      routeOptions: undefined,
      headers: {},
    };
    const reply = { statusCode: 200, elapsedTime: 10, getHeader: () => undefined };
    await onResponseHook(request, reply);
    expect(mockInc).toHaveBeenCalledWith({ method: 'GET', route: '/fallback', status_code: '200' });
  });
});
