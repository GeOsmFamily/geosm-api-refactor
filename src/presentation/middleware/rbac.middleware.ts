import type { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '../../domain/enums.js';
import { ForbiddenError } from '../../domain/errors/forbidden.error.js';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error.js';

export function requireRole(...roles: Role[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError('Authentication required');
    const userRole = request.user.role as Role;
    if (userRole === Role.SUPER_ADMIN) return;
    if (!roles.includes(userRole)) throw new ForbiddenError('Insufficient permissions');
  };
}

export function requireInstanceRole(_instanceIdParam: string, ..._roles: Role[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply) {
    if (!request.user) throw new UnauthorizedError('Authentication required');
    const userRole = request.user.role as Role;
    if (userRole === Role.SUPER_ADMIN) return;
    // For non-super-admin, instance-level role checks would query InstanceUser
    // For now, check global role against required roles
    if (!_roles.includes(userRole)) throw new ForbiddenError('Insufficient permissions');
  };
}
