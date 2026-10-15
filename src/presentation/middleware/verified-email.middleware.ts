import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../domain/errors/forbidden.error.js';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error.js';
import type { IUserRepository } from '../../domain/repositories/user.repository.js';

/**
 * Lecture seule tant que l'email n'est pas verifie (RG-A-05) : a placer apres `app.authenticate`
 * sur toute route qui publie, commente, aime, rejoint ou envoie un message.
 */
export async function requireVerifiedEmail(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.user) throw new UnauthorizedError('Authentication required');
  const userRepository = request.server.diContainer.resolve<IUserRepository>('userRepository');
  const user = await userRepository.findById(request.user.sub);
  if (!user) throw new UnauthorizedError('Authentication required');
  if (!user.emailVerifiedAt) {
    throw new ForbiddenError('Verifiez votre adresse email pour effectuer cette action');
  }
}
