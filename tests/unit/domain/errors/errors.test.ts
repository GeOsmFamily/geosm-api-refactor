import { describe, it, expect } from 'vitest';
import { NotFoundError } from '../../../../src/domain/errors/not-found.error.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';
import { ForbiddenError } from '../../../../src/domain/errors/forbidden.error.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';
import { ConflictError } from '../../../../src/domain/errors/conflict.error.js';

describe('Domain Errors', () => {
  it('NotFoundError should have correct properties', () => {
    const err = new NotFoundError('User', '123');
    expect(err.message).toBe('User with identifier "123" not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.name).toBe('NotFoundError');
  });

  it('NotFoundError without identifier', () => {
    const err = new NotFoundError('User');
    expect(err.message).toBe('User not found');
  });

  it('ValidationError should have correct properties', () => {
    const err = new ValidationError('Invalid input', { field: 'email' });
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.name).toBe('ValidationError');
    expect(err.details).toEqual({ field: 'email' });
  });

  it('ForbiddenError should have correct properties', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe('Forbidden');
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('UnauthorizedError should have correct properties', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized');
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('ConflictError should have correct properties', () => {
    const err = new ConflictError('Already exists');
    expect(err.message).toBe('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('all errors should be instances of Error', () => {
    expect(new NotFoundError('X')).toBeInstanceOf(Error);
    expect(new ValidationError('X')).toBeInstanceOf(Error);
    expect(new ForbiddenError()).toBeInstanceOf(Error);
    expect(new UnauthorizedError()).toBeInstanceOf(Error);
    expect(new ConflictError('X')).toBeInstanceOf(Error);
  });
});
