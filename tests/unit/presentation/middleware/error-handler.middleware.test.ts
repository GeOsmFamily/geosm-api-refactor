import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorHandler } from '../../../../src/presentation/middleware/error-handler.middleware.js';
import { DomainError } from '../../../../src/domain/errors/domain.error.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeRequest(): FastifyRequest {
  return { id: 'req-1', url: '/test', method: 'GET' } as unknown as FastifyRequest;
}

function makeReply() {
  const reply = {
    statusCode: 200,
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & { status: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> };
}

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle DomainError with correct status code and structure', () => {
    const reply = makeReply();
    const error = new ValidationError('Invalid input', { field: 'name' });
    errorHandler(error, makeRequest(), reply);
    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: { field: 'name' },
      }),
    }));
  });

  it('should handle rate limit errors (statusCode 429)', () => {
    const reply = makeReply();
    const error = Object.assign(new Error('rate limited'), { statusCode: 429 });
    errorHandler(error as any, makeRequest(), reply);
    expect(reply.status).toHaveBeenCalledWith(429);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'RATE_LIMITED' }),
    }));
  });

  it('should handle unknown errors as 500 INTERNAL_ERROR', () => {
    const reply = makeReply();
    const error = new Error('something broke');
    errorHandler(error, makeRequest(), reply);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    }));
  });

  it('should include meta with timestamp and requestId', () => {
    const reply = makeReply();
    errorHandler(new Error('fail'), makeRequest(), reply);
    const sent = (reply.send as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sent.meta).toBeDefined();
    expect(sent.meta.requestId).toBe('req-1');
    expect(sent.meta.timestamp).toBeDefined();
  });
});
