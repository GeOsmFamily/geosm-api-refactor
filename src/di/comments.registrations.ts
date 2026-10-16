import { asFunction, Lifetime } from 'awilix';
import type { IInstanceRepository } from '../domain/repositories/instance.repository.js';
import { PrismaPredefinedCommentRepository } from '../infrastructure/database/repositories/prisma-predefined-comment.repository.js';
import { PredefinedCommentsUseCases } from '../application/use-cases/comments/predefined-comments.use-cases.js';
import type { DomainRegistration } from './domain-registrations.js';

interface CommentsCradle {
  predefinedCommentRepository: PrismaPredefinedCommentRepository;
  instanceRepository: IInstanceRepository;
}

/** Carte et outils (chantier D) : commentaires predefinis par instance. */
export const commentsRegistrations: DomainRegistration = ({ prisma }) => ({
  predefinedCommentRepository: asFunction(() => new PrismaPredefinedCommentRepository(prisma), {
    lifetime: Lifetime.SINGLETON,
  }),
  predefinedCommentsUseCases: asFunction(
    (c: CommentsCradle) =>
      new PredefinedCommentsUseCases(c.predefinedCommentRepository, c.instanceRepository),
    { lifetime: Lifetime.SCOPED },
  ),
});
