import { Role } from '../../../domain/enums.js';
import { localize } from '../../utils/localize.js';
import type {
  PostCommentRecord,
  PostRecord,
} from '../../../infrastructure/database/repositories/prisma-post.repository.js';

export interface Actor {
  userId: string;
  role: Role;
}

/** Resolution des cles MinIO en URL presignees (MinioService). */
export interface MediaUrlResolver {
  getPresignedUrl(key: string, expirySeconds?: number): Promise<string>;
}

export interface AuthorDto {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

export interface TagDto {
  slug: string;
  label: string;
  category: 'SDG' | 'CUSTOM';
  sdgNumber: number | null;
  color: string | null;
  icon: string | null;
}

export interface PostDto {
  id: string;
  /** null : compte supprime (« Utilisateur supprime », cahier fonctionnel 4.5.6). */
  author: AuthorDto | null;
  instanceId: string;
  groupId: string | null;
  content: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  placeLabel: string | null;
  visibility: string;
  status: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  tags: TagDto[];
  media: Array<{ url: string; type: string; order: number }>;
  /** Absent pour un visiteur anonyme (cahier technique 5.2.1). */
  viewerHasLiked?: boolean;
  isAuthor?: boolean;
  editedAt: Date | null;
  createdAt: Date;
}

export interface CommentDto {
  id: string;
  postId: string;
  parentId: string | null;
  author: AuthorDto | null;
  content: string;
  likeCount: number;
  viewerHasLiked?: boolean;
  isAuthor?: boolean;
  editedAt: Date | null;
  createdAt: Date;
  replies?: CommentDto[];
}

/** Duree des URL presignees des medias (le fil est recharge bien avant expiration). */
const MEDIA_URL_TTL = 6 * 3600;

export function tagToDto(
  tag: { slug: string; label: string; category: 'SDG' | 'CUSTOM'; sdgNumber: number | null; color: string | null; icon: string | null },
  lang: string,
): TagDto {
  return {
    slug: tag.slug,
    label: localize(tag.label, lang),
    category: tag.category,
    sdgNumber: tag.sdgNumber,
    color: tag.color,
    icon: tag.icon,
  };
}

export async function postToDto(
  post: PostRecord,
  opts: { lang: string; viewerId: string | null; likedIds: Set<string>; media: MediaUrlResolver },
): Promise<PostDto> {
  const media = await Promise.all(
    post.media.map(async (m) => ({
      url: await opts.media.getPresignedUrl(m.key, MEDIA_URL_TTL),
      type: m.type,
      order: m.order,
    })),
  );
  return {
    id: post.id,
    author: post.author,
    instanceId: post.instanceId,
    groupId: post.groupId,
    content: post.content,
    lat: post.lat,
    lon: post.lon,
    radiusMeters: post.radiusMeters,
    placeLabel: post.placeLabel,
    visibility: post.visibility,
    status: post.status,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    shareCount: post.shareCount,
    tags: post.tags
      .map((pt) => tagToDto(pt.tag, opts.lang))
      .sort((a, b) => (a.sdgNumber ?? 99) - (b.sdgNumber ?? 99) || a.label.localeCompare(b.label)),
    media,
    ...(opts.viewerId
      ? { viewerHasLiked: opts.likedIds.has(post.id), isAuthor: post.authorId === opts.viewerId }
      : {}),
    editedAt: post.editedAt,
    createdAt: post.createdAt,
  };
}

export function commentToDto(
  comment: PostCommentRecord & { replies?: PostCommentRecord[] },
  viewerId: string | null,
  likedIds: Set<string>,
): CommentDto {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    author: comment.author,
    content: comment.content,
    likeCount: comment.likeCount,
    ...(viewerId
      ? { viewerHasLiked: likedIds.has(comment.id), isAuthor: comment.authorId === viewerId }
      : {}),
    editedAt: comment.editedAt,
    createdAt: comment.createdAt,
    ...(comment.replies
      ? { replies: comment.replies.map((r) => commentToDto(r, viewerId, likedIds)) }
      : {}),
  };
}

/** Curseur opaque (base64url) pour la pagination. */
export function encodeCursor(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor<T>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export const displayName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : '';

export const isModeratorRole = (role: Role) => role === Role.SUPER_ADMIN || role === Role.ADMIN_INSTANCE;
