import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestLoggerMiddleware } from '../../../../src/presentation/middleware/request-logger.middleware.js';

vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { logger } from '../../../../src/infrastructure/observability/logger.js';

describe('requestLoggerMiddleware', () => {
  let hooks: Record<string, Function>;
  let app: any;

  beforeEach(() => {
    vi.clearAllMocks();
    hooks = {};
    app = {
      addHook: vi.fn((name: string, fn: Function) => {
        hooks[name] = fn;
      }),
    };
  });

  it('should register onRequest, onResponse, and onError hooks', async () => {
    await requestLoggerMiddleware(app);
    expect(app.addHook).toHaveBeenCalledTimes(3);
    expect(hooks['onRequest']).toBeDefined();
    expect(hooks['onResponse']).toBeDefined();
    expect(hooks['onError']).toBeDefined();
  });

  it('onRequest hook should log incoming request info', async () => {
    await requestLoggerMiddleware(app);
    const request = {
      method: 'GET',
      url: '/api/test',
      id: 'req-1',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test', 'content-length': '0' },
      query: { page: '1' },
    };
    await hooks['onRequest'](request);
    expect(logger.info).toHaveBeenCalledWith('Incoming request', expect.objectContaining({
      method: 'GET',
      url: '/api/test',
    }));
  });

  it('onRequest hook should redact sensitive query params', async () => {
    await requestLoggerMiddleware(app);
    const request = {
      method: 'GET',
      url: '/api/test',
      id: 'req-1',
      ip: '127.0.0.1',
      headers: {},
      query: { token: 'secret-value', page: '1' },
    };
    await hooks['onRequest'](request);
    const call = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].query.token).toBe('[REDACTED]');
    expect(call[1].query.page).toBe('1');
  });

  it('onResponse hook should use error log level for 5xx', async () => {
    await requestLoggerMiddleware(app);
    const request = { method: 'GET', url: '/fail', id: 'req-2', ip: '127.0.0.1', headers: {} };
    const reply = { statusCode: 500, elapsedTime: 10, getHeader: () => undefined };
    await hooks['onResponse'](request, reply);
    expect(logger.error).toHaveBeenCalledWith('Request completed', expect.objectContaining({ statusCode: 500 }));
  });

  it('onResponse hook should use warn log level for 4xx', async () => {
    await requestLoggerMiddleware(app);
    const request = { method: 'GET', url: '/notfound', id: 'req-3', ip: '127.0.0.1', headers: {} };
    const reply = { statusCode: 404, elapsedTime: 5, getHeader: () => undefined };
    await hooks['onResponse'](request, reply);
    expect(logger.warn).toHaveBeenCalledWith('Request completed', expect.objectContaining({ statusCode: 404 }));
  });

  it('onResponse hook should use info log level for 2xx', async () => {
    await requestLoggerMiddleware(app);
    const request = { method: 'GET', url: '/ok', id: 'req-4', ip: '127.0.0.1', headers: {} };
    const reply = { statusCode: 200, elapsedTime: 2, getHeader: () => undefined };
    await hooks['onResponse'](request, reply);
    expect(logger.info).toHaveBeenCalledWith('Request completed', expect.objectContaining({ statusCode: 200 }));
  });

  it('onError hook should log error details', async () => {
    await requestLoggerMiddleware(app);
    const request = { method: 'POST', url: '/err', id: 'req-5', ip: '127.0.0.1', headers: {} };
    const error = new Error('boom');
    await hooks['onError'](request, {}, error);
    expect(logger.error).toHaveBeenCalledWith('Request error', expect.objectContaining({
      error: 'boom',
    }));
  });
});
