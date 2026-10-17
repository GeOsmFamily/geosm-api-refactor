import { asFunction, Lifetime } from 'awilix';
import type { IInstanceRepository } from '../domain/repositories/instance.repository.js';
import type { MinioStorageService } from '../infrastructure/storage/minio.service.js';
import type { NotificationService } from '../infrastructure/websocket/notification.service.js';
import { PrismaPostRepository } from '../infrastructure/database/repositories/prisma-post.repository.js';
import { PrismaContentReportRepository } from '../infrastructure/database/repositories/prisma-content-report.repository.js';
import { PostsUseCases } from '../application/use-cases/posts/posts.use-cases.js';
import { PostCommentsUseCases } from '../application/use-cases/posts/post-comments.use-cases.js';
import { PostModerationUseCases } from '../application/use-cases/posts/post-moderation.use-cases.js';
import { PostMediaUseCase } from '../application/use-cases/posts/post-media.use-case.js';
import type { DomainRegistration } from './domain-registrations.js';

interface PostsCradle {
  postRepository: PrismaPostRepository;
  contentReportRepository: PrismaContentReportRepository;
  instanceRepository: IInstanceRepository;
  storageService: MinioStorageService;
  notificationService: NotificationService;
  postsUseCases: PostsUseCases;
}

/** Fil social geolocalise (chantier E, etape 2.2). */
export const postsRegistrations: DomainRegistration = ({ prisma }) => ({
  postRepository: asFunction(() => new PrismaPostRepository(prisma), { lifetime: Lifetime.SINGLETON }),
  contentReportRepository: asFunction(() => new PrismaContentReportRepository(prisma), {
    lifetime: Lifetime.SINGLETON,
  }),
  postsUseCases: asFunction(
    (c: PostsCradle) =>
      new PostsUseCases(c.postRepository, c.instanceRepository, c.storageService, c.notificationService),
    { lifetime: Lifetime.SINGLETON },
  ),
  postCommentsUseCases: asFunction(
    (c: PostsCradle) => new PostCommentsUseCases(c.postRepository, c.postsUseCases, c.notificationService),
    { lifetime: Lifetime.SINGLETON },
  ),
  postModerationUseCases: asFunction(
    (c: PostsCradle) =>
      new PostModerationUseCases(
        c.postRepository,
        c.contentReportRepository,
        c.instanceRepository,
        c.notificationService,
      ),
    { lifetime: Lifetime.SINGLETON },
  ),
  postMediaUseCase: asFunction((c: PostsCradle) => new PostMediaUseCase(c.storageService), {
    lifetime: Lifetime.SINGLETON,
  }),
});
