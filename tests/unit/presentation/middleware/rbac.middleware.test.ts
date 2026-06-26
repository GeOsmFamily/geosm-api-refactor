import { describe, it, expect, vi } from 'vitest';
import { requireRole, requireInstanceRole } from '../../../../src/presentation/middleware/rbac.middleware.js';
import { Role } from '../../../../src/domain/enums.js';
import { ForbiddenError } from '../../../../src/domain/errors/forbidden.error.js';
import { UnauthorizedError } from '../../../../src/domain/errors/unauthorized.error.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function makeRequest(user?: { role: string }): FastifyRequest {
  return { user } as unknown as FastifyRequest;
}

const reply = {} as FastifyReply;

describe('requireRole', () => {
  it('should throw UnauthorizedError when no user on request', async () => {
    const middleware = requireRole(Role.ADMIN_INSTANCE);
    await expect(middleware(makeRequest(), reply)).rejects.toThrow(UnauthorizedError);
  });

  it('should allow SUPER_ADMIN regardless of required roles', async () => {
    const middleware = requireRole(Role.EDITOR);
    await expect(middleware(makeRequest({ role: Role.SUPER_ADMIN }), reply)).resolves.toBeUndefined();
  });

  it('should allow user with matching role', async () => {
    const middleware = requireRole(Role.EDITOR, Role.VIEWER);
    await expect(middleware(makeRequest({ role: Role.EDITOR }), reply)).resolves.toBeUndefined();
  });

  it('should throw ForbiddenError when role does not match', async () => {
    const middleware = requireRole(Role.ADMIN_INSTANCE);
    await expect(middleware(makeRequest({ role: Role.VIEWER }), reply)).rejects.toThrow(ForbiddenError);
  });
});

describe('requireInstanceRole', () => {
  it('should throw UnauthorizedError when no user', async () => {
    const middleware = requireInstanceRole('instanceId', Role.EDITOR);
    await expect(middleware(makeRequest(), reply)).rejects.toThrow(UnauthorizedError);
  });

  it('should allow SUPER_ADMIN', async () => {
    const middleware = requireInstanceRole('instanceId', Role.EDITOR);
    await expect(middleware(makeRequest({ role: Role.SUPER_ADMIN }), reply)).resolves.toBeUndefined();
  });

  it('should throw ForbiddenError for insufficient role', async () => {
    const middleware = requireInstanceRole('instanceId', Role.ADMIN_INSTANCE);
    await expect(middleware(makeRequest({ role: Role.VIEWER }), reply)).rejects.toThrow(ForbiddenError);
  });
});
