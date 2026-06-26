import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../domain/errors/domain.error.js';
import { logger } from '../../infrastructure/observability/logger.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

export function errorHandler(
  error: FastifyError | DomainError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const timestamp = new Date().toISOString();
  const requestId = request.id;

  if (error instanceof DomainError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: { timestamp, requestId },
    };
    reply.status(error.statusCode).send(response);
    return;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode === 400) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
      meta: { timestamp, requestId },
    };
    reply.status(400).send(response);
    return;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number' && error.statusCode === 429) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      },
      meta: { timestamp, requestId },
    };
    reply.status(429).send(response);
    return;
  }

  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: request.url,
    method: request.method,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred',
    },
    meta: { timestamp, requestId },
  };
  reply.status(500).send(response);
}
