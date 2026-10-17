import type { MediaType, PostVisibility } from '@prisma/client';
import type {
  FeedQuery,
  PostPin,
  PostRecord,
  PrismaPostRepository,
} from '../../../infrastructure/database/repositories/prisma-post.repository.js';
import type { IInstanceRepository } from '../../../domain/repositories/instance.repository.js';
import { NotFoundError } from '../../../domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../domain/errors/forbidden.error.js';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { SocialNotificationType } from '../../../domain/notifications/social-notification-types.js';
import { createChildLogger } from '../../../infrastructure/observability/logger.js';
import {
  createSocialCounter,
  logSocialEvent,
  withUseCaseSpan,
} from '../../../infrastructure/observability/social-telemetry.js';
import {
  type Actor,
  type MediaUrlResolver,
  type PostDto,
  type TagDto,
  decodeCursor,
  displayName,
  encodeCursor,
  isModeratorRole,
  postToDto,
  tagToDto,
} from './post-dto.js';

const logger = createChildLogger('PostsUseCases');
const postsCreated = createSocialCounter('posts_created_total', 'Publications creees');
const postsLiked = createSocialCounter('post_likes_total', "J'aime ajoutes sur des publications");

/** Regles de gestion du fil (cahier fonctionnel 4.5.5, ADR 0007 point 5). */
export const POST_RULES = {
  minRadius: 100, // RG-E-01
  maxRadius: 25_000, // RG-E-01
  maxSdgTags: 5, // RG-E-03
  maxCustomTags: 20,
  maxMedia: 4,
  maxContent: 2000,
  feedMaxRadius: 50_000,
  pinsLimit: 500,
} as const;

export interface PostMediaStore extends MediaUrlResolver {
  fileExists(key: string): Promise<boolean>;
  deleteFile(key: string): Promise<void>;
}

export interface Notifier {
  notifyUser(userId: string, event: string, data: unknown): Promise<void>;
}

export interface FeedParams {
  lat?: number;
  lon?: number;
  radius?: number;
  bbox?: [number, number, number, number];
  tags?: string[];
  authorId?: string;
  sort?: 'recent' | 'popular';
  cursor?: string;
  limit?: number;
}

export interface CreatePostInput {
  content: string;
  lat: number;
  lon: number;
  radiusMeters?: number;
  placeLabel?: string | null;
  visibility?: PostVisibility;
  groupId?: string | null;
  tagSlugs: string[];
  media?: Array<{ key: string; type: MediaType }>;
}

export interface UpdatePostInput {
  content?: string;
  placeLabel?: string | null;
  visibility?: PostVisibility;
  tagSlugs?: string[];
}

/** Cle d'un media televerse par cet utilisateur (voir PostMediaUseCase). */
export const mediaKeyPrefix = (userId: string) => `posts/${userId}/`;

/**
 * Fil social geolocalise (chantier E) : lecture du fil et de la carte synchronisee, creation,
 * modification et suppression d'une publication, j'aime et partage.
 */
export class PostsUseCases {
  constructor(
    private readonly repository: PrismaPostRepository,
    private readonly instanceRepository: IInstanceRepository,
    private readonly media: PostMediaStore,
    private readonly notifier: Notifier,
  ) {}

  async listTags(instanceId: string | null, lang: string, category?: 'SDG' | 'CUSTOM'): Promise<TagDto[]> {
    const tags = await this.repository.listTags(instanceId, category);
    return tags.map((t) => tagToDto(t, lang));
  }

  async feed(
    instanceId: string,
    viewer: Actor | null,
    params: FeedParams,
    lang: string,
  ): Promise<{ items: PostDto[]; nextCursor: string | null; hasMore: boolean }> {
    await this.requireInstance(instanceId);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 50);
    const sort = params.sort ?? 'recent';
    const cursor = decodeCursor<{ c?: string; i?: string; o?: number }>(params.cursor);
    let after: FeedQuery['after'];
    if (cursor && sort === 'popular' && typeof cursor.o === 'number') after = { offset: cursor.o };
    if (cursor && sort === 'recent' && cursor.c && cursor.i) {
      after = { createdAt: new Date(cursor.c), id: cursor.i };
    }

    const ids = await this.repository.findFeedIds({
      ...this.baseQuery(instanceId, viewer, params),
      sort,
      after,
      limit: limit + 1,
    });
    const hasMore = ids.length > limit;
    const posts = await this.repository.findManyByIds(ids.slice(0, limit));
    const items = await this.toDtos(posts, viewer, lang);

    let nextCursor: string | null = null;
    if (hasMore && items.length) {
      const last = items[items.length - 1];
      nextCursor =
        sort === 'popular'
          ? encodeCursor({ o: (after && 'offset' in after ? after.offset : 0) + limit })
          : encodeCursor({ c: last.createdAt.toISOString(), i: last.id });
    }
    return { items, nextCursor, hasMore };
  }

  /** Epingles de la carte synchronisee (cahier fonctionnel 4.5.3). */
  async pins(instanceId: string, viewer: Actor | null, params: FeedParams): Promise<PostPin[]> {
    await this.requireInstance(instanceId);
    return this.repository.findPins({
      ...this.baseQuery(instanceId, viewer, params),
      limit: POST_RULES.pinsLimit,
    });
  }

  async get(id: string, viewer: Actor | null, lang: string): Promise<PostDto> {
    const post = await this.requireVisible(id, viewer);
    return (await this.toDtos([post], viewer, lang))[0];
  }

  async create(instanceId: string, actor: Actor, input: CreatePostInput, lang: string): Promise<PostDto> {
    return withUseCaseSpan('CreatePost', { userId: actor.userId, instanceId }, async () => {
      const instance = await this.requireInstance(instanceId);
      if (input.groupId || input.visibility === 'GROUP') {
        // Les groupes sociaux arrivent en phase 3 (cahier technique 5.2.2).
        throw new ValidationError('Les publications de groupe ne sont pas encore disponibles', {});
      }
      this.checkRadius(input.radiusMeters);
      const bbox = instance.bbox;
      if (bbox?.length === 4 && !inBbox(input.lat, input.lon, bbox)) {
        throw new ValidationError('Le lieu de la publication est hors du pays', {});
      }
      const tagIds = await this.resolveTags(instanceId, input.tagSlugs);
      const media = await this.checkMedia(actor.userId, input.media ?? []);

      const post = await this.repository.create({
        authorId: actor.userId,
        instanceId,
        content: input.content.trim(),
        lat: input.lat,
        lon: input.lon,
        radiusMeters: input.radiusMeters ?? 1500,
        placeLabel: input.placeLabel?.trim() || null,
        visibility: input.visibility ?? 'PUBLIC',
        tagIds,
        media,
      });
      postsCreated.inc({ instance_id: instanceId });
      logSocialEvent(logger, 'info', 'post.created', { userId: actor.userId, instanceId }, {
        postId: post.id,
        tags: input.tagSlugs.length,
        media: media.length,
      });
      return (await this.toDtos([post], actor, lang))[0];
    });
  }

  /** Modification par l'auteur ; un texte modifie porte la mention « modifie » (RG-E-07). */
  async update(id: string, actor: Actor, input: UpdatePostInput, lang: string): Promise<PostDto> {
    const post = await this.requirePost(id);
    if (post.authorId !== actor.userId) throw new ForbiddenError("Seul l'auteur peut modifier la publication");
    if (input.visibility === 'GROUP') {
      throw new ValidationError('Les publications de groupe ne sont pas encore disponibles', {});
    }
    const tagIds = input.tagSlugs ? await this.resolveTags(post.instanceId, input.tagSlugs) : undefined;
    const content = input.content?.trim();
    const updated = await this.repository.update(id, {
      content,
      placeLabel: input.placeLabel === undefined ? undefined : input.placeLabel?.trim() || null,
      visibility: input.visibility,
      tagIds,
      edited: content !== undefined && content !== post.content,
    });
    logSocialEvent(logger, 'info', 'post.updated', { userId: actor.userId, instanceId: post.instanceId }, { postId: id });
    return (await this.toDtos([updated], actor, lang))[0];
  }

  /** Auteur, super-administrateur ou administrateur de l'instance. */
  async remove(id: string, actor: Actor): Promise<void> {
    const post = await this.requirePost(id);
    if (post.authorId !== actor.userId && !(await this.canModerate(actor, post.instanceId))) {
      throw new ForbiddenError('Suppression non autorisee');
    }
    await this.repository.delete(id);
    // Medias : nettoyage best-effort, la publication est deja supprimee.
    await Promise.all(post.media.map((m) => this.media.deleteFile(m.key).catch(() => undefined)));
    logSocialEvent(logger, 'info', 'post.deleted', { userId: actor.userId, instanceId: post.instanceId }, {
      postId: id,
      byModerator: post.authorId !== actor.userId,
    });
  }

  async toggleLike(id: string, actor: Actor): Promise<{ postId: string; reacted: boolean; likeCount: number }> {
    const post = await this.requireVisible(id, actor);
    const result = await this.repository.toggleLike(id, actor.userId);
    if (result.reacted) {
      postsLiked.inc({ instance_id: post.instanceId });
      if (post.authorId && post.authorId !== actor.userId) {
        void this.notifier.notifyUser(post.authorId, SocialNotificationType.POST_LIKED, {
          postId: id,
          likedByUserId: actor.userId,
          likedByName: await this.nameOf(actor.userId),
        });
      }
    }
    return { postId: id, ...result };
  }

  /** Partage (lien copie, reseau externe) : seul le compteur est tenu cote serveur. */
  async share(id: string, viewer: Actor | null): Promise<{ postId: string; shareCount: number }> {
    await this.requireVisible(id, viewer);
    return { postId: id, shareCount: await this.repository.incrementShares(id) };
  }

  // --- Interne ---------------------------------------------------------------------------------

  private baseQuery(instanceId: string, viewer: Actor | null, params: FeedParams): Omit<FeedQuery, 'sort' | 'after' | 'limit'> {
    const hasPoint = params.lat !== undefined && params.lon !== undefined;
    return {
      instanceId,
      viewerId: viewer?.userId ?? null,
      // Sans position, tout le pays actif (cahier fonctionnel 4.5.6, nouveau compte).
      near: hasPoint
        ? {
            lat: params.lat!,
            lon: params.lon!,
            radius: Math.min(params.radius ?? 5000, POST_RULES.feedMaxRadius),
          }
        : undefined,
      bbox: params.bbox,
      tagSlugs: params.tags?.filter(Boolean),
      authorId: params.authorId,
    };
  }

  private async toDtos(posts: PostRecord[], viewer: Actor | null, lang: string): Promise<PostDto[]> {
    const likedIds = viewer
      ? await this.repository.likedPostIds(viewer.userId, posts.map((p) => p.id))
      : new Set<string>();
    return Promise.all(
      posts.map((p) => postToDto(p, { lang, viewerId: viewer?.userId ?? null, likedIds, media: this.media })),
    );
  }

  private checkRadius(radius: number | undefined): void {
    if (radius === undefined) return;
    if (!Number.isInteger(radius) || radius < POST_RULES.minRadius || radius > POST_RULES.maxRadius) {
      throw new ValidationError(
        `Le rayon doit etre compris entre ${POST_RULES.minRadius} m et ${POST_RULES.maxRadius / 1000} km`,
        { minRadius: POST_RULES.minRadius, maxRadius: POST_RULES.maxRadius },
      );
    }
  }

  /** RG-E-02 (au moins un ODD ou une etiquette) et RG-E-03 (cinq ODD au plus). */
  private async resolveTags(instanceId: string, slugs: string[]): Promise<string[]> {
    const unique = [...new Set(slugs)];
    if (!unique.length) {
      throw new ValidationError('Choisissez au moins un sujet ODD ou une etiquette', { field: 'tagSlugs' });
    }
    const tags = await this.repository.findTagsBySlugs(unique);
    const allowed = tags.filter((t) => t.instanceId === null || t.instanceId === instanceId);
    if (allowed.length !== unique.length) {
      const known = new Set(allowed.map((t) => t.slug));
      throw new ValidationError('Etiquette inconnue', { unknown: unique.filter((s) => !known.has(s)) });
    }
    const sdg = allowed.filter((t) => t.category === 'SDG').length;
    if (sdg > POST_RULES.maxSdgTags) {
      throw new ValidationError(`${POST_RULES.maxSdgTags} sujets ODD au plus`, { field: 'tagSlugs' });
    }
    if (allowed.length - sdg > POST_RULES.maxCustomTags) {
      throw new ValidationError(`${POST_RULES.maxCustomTags} etiquettes au plus`, { field: 'tagSlugs' });
    }
    return allowed.map((t) => t.id);
  }

  /** Medias deja televerses par CET utilisateur (PostMediaUseCase), quatre au plus. */
  private async checkMedia(
    userId: string,
    media: Array<{ key: string; type: MediaType }>,
  ): Promise<Array<{ key: string; type: MediaType; order: number }>> {
    if (media.length > POST_RULES.maxMedia) {
      throw new ValidationError(`${POST_RULES.maxMedia} medias au plus`, { field: 'media' });
    }
    for (const m of media) {
      if (!m.key.startsWith(mediaKeyPrefix(userId)) || m.key.includes('..')) {
        throw new ForbiddenError('Media non autorise');
      }
      if (!(await this.media.fileExists(m.key))) {
        throw new ValidationError('Media introuvable, televersez-le de nouveau', { key: m.key });
      }
    }
    return media.map((m, order) => ({ key: m.key, type: m.type, order }));
  }

  private async requireInstance(instanceId: string) {
    const instance = await this.instanceRepository.findById(instanceId);
    if (!instance) throw new NotFoundError('Instance', instanceId);
    return instance;
  }

  private async requirePost(id: string): Promise<PostRecord> {
    const post = await this.repository.findById(id);
    if (!post) throw new NotFoundError('Post', id);
    return post;
  }

  /**
   * Publication lisible par ce lecteur : publiee et publique, ou brouillon prive de son auteur.
   * Une publication masquee reste lisible par son auteur et par la moderation.
   */
  private async requireVisible(id: string, viewer: Actor | null): Promise<PostRecord> {
    const post = await this.requirePost(id);
    const isAuthor = !!viewer && post.authorId === viewer.userId;
    if (isAuthor) return post;
    if (viewer && post.status !== 'REMOVED' && (await this.canModerate(viewer, post.instanceId))) return post;
    if (post.status !== 'PUBLISHED' || post.visibility !== 'PUBLIC') throw new NotFoundError('Post', id);
    return post;
  }

  private async canModerate(actor: Actor, instanceId: string): Promise<boolean> {
    if (!isModeratorRole(actor.role)) return false;
    if (actor.role === 'SUPER_ADMIN') return true;
    return this.repository.isInstanceAdmin(actor.userId, instanceId);
  }

  private async nameOf(userId: string): Promise<string> {
    const user = await this.repository.findAuthor(userId);
    return displayName(user);
  }
}

function inBbox(lat: number, lon: number, bbox: number[]): boolean {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
}
