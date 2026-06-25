import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { jwtConfig } from '../../config/jwt.config.js';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error.js';
import { ForbiddenError } from '../../domain/errors/forbidden.error.js';
import { Role } from '../../domain/enums.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string };
    user: { sub: string; email: string; role: string };
  }
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: jwtConfig.accessSecret,
  });

  app.decorate('authenticate', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });

  app.decorate(
    'authorize',
    function (...roles: Role[]) {
      return async function (request: FastifyRequest, _reply: FastifyReply) {
        try {
          await request.jwtVerify();
        } catch {
          throw new UnauthorizedError('Invalid or expired access token');
        }
        const userRole = request.user.role as Role;
        if (!roles.includes(userRole)) {
          throw new ForbiddenError('Insufficient permissions');
        }
      };
    },
  );
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (...roles: Role[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
