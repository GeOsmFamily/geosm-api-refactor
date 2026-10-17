import type { PrismaClient } from '@prisma/client';
import type { Resolver } from 'awilix';
import { territoryRegistrations } from './territory.registrations.js';
import { notificationsRegistrations } from './notifications.registrations.js';
import { authRegistrations } from './auth.registrations.js';
import { commentsRegistrations } from './comments.registrations.js';
import { postsRegistrations } from './posts.registrations.js';

/**
 * Registre d'injection par domaine.
 *
 * `src/container.ts` regroupe les registrations historiques (SIG). Les nouveaux domaines de
 * GeOsm Family (posts, groupes, evenements, messagerie, connexions, gamification...) ne s'y
 * ajoutent PAS : chacun expose ici une fonction qui retourne ses propres resolvers, ce qui evite
 * de faire grossir un fichier de ~2000 lignes.
 *
 * Exemple (src/di/posts.registrations.ts) :
 *
 *   export const postsRegistrations: DomainRegistration = ({ prisma }) => ({
 *     postRepository: asFunction(() => new PrismaPostRepository(prisma), { lifetime: Lifetime.SINGLETON }),
 *     createPostUseCase: asFunction((c) => new CreatePostUseCase(c.postRepository), { lifetime: Lifetime.SCOPED }),
 *   });
 *
 * puis l'ajouter a `domainRegistrations` ci-dessous.
 */
export interface DomainRegistrationDeps {
  prisma: PrismaClient;
}

export type DomainRegistration = (deps: DomainRegistrationDeps) => Record<string, Resolver<unknown>>;

/** Domaines GeOsm Family enregistres, dans l'ordre. */
export const domainRegistrations: DomainRegistration[] = [
  territoryRegistrations,
  notificationsRegistrations,
  authRegistrations,
  commentsRegistrations,
  postsRegistrations,
];

export function collectDomainRegistrations(
  deps: DomainRegistrationDeps,
  registrations: DomainRegistration[] = domainRegistrations,
): Record<string, Resolver<unknown>> {
  const merged: Record<string, Resolver<unknown>> = {};
  for (const register of registrations) {
    for (const [name, resolver] of Object.entries(register(deps))) {
      if (name in merged) {
        throw new Error(`Cle d'injection dupliquee entre domaines : "${name}"`);
      }
      merged[name] = resolver;
    }
  }
  return merged;
}
